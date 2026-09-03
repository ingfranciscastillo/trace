import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "../db";
import { articles, claimSources, claims, relationships, searches } from "../db/schema";

interface ArticleRow {
	id: number;
	url: string;
	domain: string;
	title: string;
	publishedAt: string | null;
	fetchedAt: string;
}

export type HistoryResult =
	| { signedIn: false }
	| { signedIn: true; roots: (ArticleRow & { related: ArticleRow[] })[] };

// History is per-user and requires a session both to view and to have ever
// been recorded — an anonymous trace is never written to `searches`, and an
// anonymous request here gets nothing back regardless of what's in the DB.
export const getHistory = createServerFn({ method: "POST" }).handler(
	async (): Promise<HistoryResult> => {
		const session = await auth.api.getSession({ headers: getRequestHeaders() });
		if (!session) return { signedIn: false };

		const mySearches = await db
			.select({ articleId: searches.articleId })
			.from(searches)
			.where(eq(searches.userId, session.user.id));
		const myArticleIds = new Set(mySearches.map((s) => s.articleId));
		if (myArticleIds.size === 0) return { signedIn: true, roots: [] };

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
			.where(inArray(articles.id, [...myArticleIds]));

		const toRow = (a: (typeof all)[number]): ArticleRow => ({
			id: a.id,
			url: a.url,
			domain: a.domain,
			title: a.title,
			publishedAt: a.publishedAt,
			fetchedAt: a.fetchedAt.toISOString(),
		});

		// Only a URL the user pasted directly (depth 0) is a top-level root.
		// Anything they reached by chasing a source (depth > 0 — findSources,
		// resolveSource, or "REVIEW THIS ARTICLE") nests under whichever root(s)
		// it's related to instead, even though it's technically its own search too.
		const roots = all
			.filter((a) => a.depth === 0)
			.sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime());

		if (roots.length === 0) return { signedIn: true, roots: [] };

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
		const allById = new Map(all.map((a) => [a.id, a]));

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
			// Only nest an article that's (a) in the user's own searched set, so a
			// sub-item is always something they can revisit, and (b) not itself a
			// depth-0 root — otherwise two roots that happen to cite each other
			// would each list the other as "related", duplicating both at the top
			// level and nested underneath it.
			return new Set(
				[...ids].filter((id) => myArticleIds.has(id) && allById.get(id)?.depth !== 0),
			);
		}

		return {
			signedIn: true,
			roots: roots.map((root) => ({
				...toRow(root),
				related: [...relatedIdsFor(root.id)].map((id) => toRow(allById.get(id)!)),
			})),
		};
	},
);
