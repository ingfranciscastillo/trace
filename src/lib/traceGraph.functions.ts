import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { articles } from "../db/schema";
import { saveArticle } from "./articleStore";
import { extractArticleImpl, extractUrlSchema } from "./extractArticle.functions";
import { isFirecrawlConfigured } from "./firecrawl";
import { buildTraceGraph, type TraceGraph } from "./traceGraph";

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
): Promise<TraceResult> {
	const parsed = extractUrlSchema.safeParse(rawUrl);
	if (!parsed.success) return { ok: false, url: rawUrl, error: "invalid_url" };
	const url = parsed.data;

	const [existing] = await db.select().from(articles).where(eq(articles.url, url));

	let articleId: number;
	if (existing) {
		articleId = existing.id;
	} else {
		// Only actually attempted server-side if a session (API key) is
		// configured — a toggle flipped on by an anonymous visitor can't force
		// a real Firecrawl call to happen without one.
		const extracted = await extractArticleImpl(
			url,
			useFirecrawl && isFirecrawlConfigured(),
		);
		if (!extracted.ok) return { ok: false, url, error: extracted.error };
		const saved = await saveArticle(extracted);
		articleId = saved.articleId;
	}

	const graph = await buildTraceGraph(articleId);
	return { ok: true, ...graph };
}

export const getTrace = createServerFn({ method: "GET" })
	.validator((data: unknown) => getTraceInput.parse(data))
	.handler(async ({ data }) => getTraceImpl(data.url, data.useFirecrawl ?? false));

// Lets the UI decide whether to even offer the Firecrawl toggle's "on" state
// as meaningful — visible to everyone, but only true when the server side
// actually has a session configured. POST, not GET: this takes no arguments,
// so a GET would hit the exact same URL every time and risk being served
// from a stale browser cache instead of re-checking the server.
export const getFirecrawlStatus = createServerFn({ method: "POST" }).handler(
	async () => ({ configured: isFirecrawlConfigured() }),
);
