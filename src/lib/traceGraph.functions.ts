import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { articles } from "../db/schema";
import { saveArticle } from "./articleStore";
import { extractArticleImpl, extractUrlSchema } from "./extractArticle.functions";
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

async function getTraceImpl(rawUrl: string): Promise<TraceResult> {
	const parsed = extractUrlSchema.safeParse(rawUrl);
	if (!parsed.success) return { ok: false, url: rawUrl, error: "invalid_url" };
	const url = parsed.data;

	const [existing] = await db.select().from(articles).where(eq(articles.url, url));

	let articleId: number;
	if (existing) {
		articleId = existing.id;
	} else {
		const extracted = await extractArticleImpl(url);
		if (!extracted.ok) return { ok: false, url, error: extracted.error };
		const saved = await saveArticle(extracted);
		articleId = saved.articleId;
	}

	const graph = await buildTraceGraph(articleId);
	return { ok: true, ...graph };
}

export const getTrace = createServerFn({ method: "GET" })
	.validator((data: unknown) => z.string().parse(data))
	.handler(async ({ data }) => getTraceImpl(data));
