import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "../db";
import { articles, claims, links } from "../db/schema";
import type { ExtractOk } from "./extractArticle.functions";
import { buildRelationships, type RelationshipCounts } from "./relationshipStore";
import { buildFirstSeen } from "./firstSeenStore";

export async function saveArticle(
	result: ExtractOk,
	depth = 0,
): Promise<{
	articleId: number;
	relationships: RelationshipCounts;
	firstSeenUpdated: number;
}> {
	const { articleId } = await db.transaction(async (tx) => {
		const [savedArticle] = await tx
			.insert(articles)
			.values({
				url: result.url,
				domain: result.domain,
				title: result.title,
				author: result.author,
				publishedAt: result.publishedAt,
				excerpt: result.excerpt,
				textContent: result.textContent,
				textLength: result.textLength,
				depth,
			})
			.onConflictDoUpdate({
				target: articles.url,
				set: {
					domain: result.domain,
					title: result.title,
					author: result.author,
					publishedAt: result.publishedAt,
					excerpt: result.excerpt,
					textContent: result.textContent,
					textLength: result.textLength,
					fetchedAt: new Date(),
					depth: sql`LEAST(${articles.depth}, ${depth})`,
				},
			})
			.returning({ id: articles.id });

		const articleId = savedArticle.id;

		await tx.delete(links).where(eq(links.articleId, articleId));

		// Upsert-in-place (not delete+reinsert) so a claim's id survives re-extraction —
		// claim_sources references claims by id, and would cascade-delete otherwise.
		if (result.claims.length > 0) {
			await tx
				.insert(claims)
				.values(
					result.claims.map((claim) => ({
						articleId,
						text: claim.text,
						paragraphIndex: claim.paragraphIndex,
						signals: claim.signals,
					})),
				)
				.onConflictDoUpdate({
					target: [claims.articleId, claims.text],
					set: {
						paragraphIndex: sql`excluded.paragraph_index`,
						signals: sql`excluded.signals`,
					},
				});
			await tx.delete(claims).where(
				and(
					eq(claims.articleId, articleId),
					notInArray(
						claims.text,
						result.claims.map((c) => c.text),
					),
				),
			);
		} else {
			await tx.delete(claims).where(eq(claims.articleId, articleId));
		}

		if (result.links.length > 0) {
			await tx.insert(links).values(
				result.links.map((link) => ({
					articleId,
					href: link.href,
					text: link.text,
					isExternal: link.isExternal,
					isCitation: link.isCitation,
				})),
			);
		}

		return { articleId };
	});

	const relationshipCounts = await buildRelationships(articleId, result.url);
	const firstSeenUpdated = await buildFirstSeen(articleId);
	return { articleId, relationships: relationshipCounts, firstSeenUpdated };
}
