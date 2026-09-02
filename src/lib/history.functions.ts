import { createServerFn } from "@tanstack/react-start";
import { desc } from "drizzle-orm";
import { db } from "../db";
import { articles } from "../db/schema";

export const getHistory = createServerFn({ method: "POST" }).handler(
	async () => {
		const rows = await db
			.select({
				id: articles.id,
				url: articles.url,
				domain: articles.domain,
				title: articles.title,
				publishedAt: articles.publishedAt,
				fetchedAt: articles.fetchedAt,
			})
			.from(articles)
			.orderBy(desc(articles.fetchedAt))
			.limit(50);

		return rows.map((r) => ({ ...r, fetchedAt: r.fetchedAt.toISOString() }));
	},
);
