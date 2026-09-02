import { createServerFn } from "@tanstack/react-start";
import { desc } from "drizzle-orm";
import { db } from "../db";
import { articles, claimSources, claims, relationships } from "../db/schema";

interface ArticleRow {
	id: number;
	url: string;
	domain: string;
	title: string;
	publishedAt: string | null;
	fetchedAt: string;
}

export const getHistory = createServerFn({ method: "POST" }).handler(
	async () => {
		const all = await db
			.select({
				id: articles.id,
				url: articles.url,
				domain: articles.domain,
				title: articles.title,
				publishedAt: articles.publishedAt,
				fetchedAt: articles.fetchedAt,
				depth: articles.depth,
			})
			.from(articles)
			.orderBy(desc(articles.fetchedAt));

		const toRow = (a: (typeof all)[number]): ArticleRow => ({
			id: a.id,
			url: a.url,
			domain: a.domain,
			title: a.title,
			publishedAt: a.publishedAt,
			fetchedAt: a.fetchedAt.toISOString(),
		});

		const roots = all.filter((a) => a.depth === 0);
		const nonRootById = new Map(
			all.filter((a) => a.depth > 0).map((a) => [a.id, a]),
		);

		if (roots.length === 0) return [];

		const rels = await db
			.select({
				articleAId: relationships.articleAId,
				articleBId: relationships.articleBId,
			})
			.from(relationships);
		const claimRows = await db
			.select({ id: claims.id, articleId: claims.articleId })
			.from(claims);
		const sourceRows = await db
			.select({ claimId: claimSources.claimId, articleId: claimSources.articleId })
			.from(claimSources);

		const claimToArticle = new Map(claimRows.map((c) => [c.id, c.articleId]));

		function relatedIdsFor(rootId: number): Set<number> {
			const ids = new Set<number>();
			for (const r of rels) {
				if (r.articleAId === rootId) ids.add(r.articleBId);
				if (r.articleBId === rootId) ids.add(r.articleAId);
			}
			for (const s of sourceRows) {
				if (s.articleId && claimToArticle.get(s.claimId) === rootId) {
					ids.add(s.articleId);
				}
			}
			ids.delete(rootId);
			return ids;
		}

		return roots.map((root) => {
			const relatedIds = [...relatedIdsFor(root.id)].filter((id) =>
				nonRootById.has(id),
			);
			return {
				...toRow(root),
				related: relatedIds.map((id) => toRow(nonRootById.get(id)!)),
			};
		});
	},
);
