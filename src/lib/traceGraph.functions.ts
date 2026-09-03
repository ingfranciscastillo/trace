import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "../db";
import { articles, searches } from "../db/schema";
import { saveArticle } from "./articleStore";
import { extractArticleImpl, extractUrlSchema } from "./extractArticle.functions";
import { isFirecrawlConfigured } from "./firecrawl";
import { buildTraceGraph, type TraceGraph } from "./traceGraph";
import { canUseFirecrawl } from "./usageLimits";

// Anonymous visitors can trace freely, but nothing is recorded for them —
// History is opt-in by virtue of being signed in, both to view and to save.
// Headers are captured by the caller, synchronously, before any other await —
// grabbing them this deep in the call chain risks losing the request context
// that getRequestHeaders() depends on. Best-effort: recording a search should
// never be able to break viewing the trace itself.
async function recordSearch(articleId: number, headers: Headers): Promise<void> {
	try {
		const session = await auth.api.getSession({ headers });
		if (!session) return;

		await db
			.insert(searches)
			.values({ userId: session.user.id, articleId })
			.onConflictDoUpdate({
				target: [searches.userId, searches.articleId],
				set: { searchedAt: new Date() },
			});
	} catch {
		// Non-fatal — the trace itself already succeeded.
	}
}

export type TraceResult =
	| ({ ok: true } & TraceGraph)
	| {
			ok: false;
			url: string;
			error:
				| "invalid_url"
				| "fetch_failed"
				| "not_html"
				| "no_article_content"
				| "blocked";
	  };

const getTraceInput = z.object({
	url: z.string(),
	useFirecrawl: z.boolean().optional(),
});

async function getTraceImpl(
	rawUrl: string,
	useFirecrawl: boolean,
	headers: Headers,
): Promise<TraceResult> {
	const parsed = extractUrlSchema.safeParse(rawUrl);
	if (!parsed.success) return { ok: false, url: rawUrl, error: "invalid_url" };
	const url = parsed.data;

	const [existing] = await db.select().from(articles).where(eq(articles.url, url));

	let articleId: number;
	if (existing) {
		articleId = existing.id;
	} else {
		// Re-verified server-side (session + monthly quota) — the UI toggle is
		// not the actual gate, since this handler is reachable directly.
		const extracted = await extractArticleImpl(
			url,
			useFirecrawl && (await canUseFirecrawl(headers)),
		);
		if (!extracted.ok) return { ok: false, url, error: extracted.error };
		const saved = await saveArticle(extracted);
		articleId = saved.articleId;
	}

	await recordSearch(articleId, headers);

	const graph = await buildTraceGraph(articleId);
	return { ok: true, ...graph };
}

export const getTrace = createServerFn({ method: "GET" })
	.validator((data: unknown) => getTraceInput.parse(data))
	.handler(async ({ data }) => {
		const headers = getRequestHeaders();
		return getTraceImpl(data.url, data.useFirecrawl ?? false, headers);
	});

// Lets the UI decide whether to even offer the Firecrawl toggle's "on" state
// as meaningful — visible to everyone, but only true when the server side
// actually has a session configured. POST, not GET: this takes no arguments,
// so a GET would hit the exact same URL every time and risk being served
// from a stale browser cache instead of re-checking the server.
export const getFirecrawlStatus = createServerFn({ method: "POST" }).handler(
	async () => ({ configured: isFirecrawlConfigured() }),
);
