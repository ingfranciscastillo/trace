import { eq, ne } from "drizzle-orm";
import { db } from "../db";
import { articles, claims } from "../db/schema";
import { sentenceSimilarity } from "./detectCopies";

const MIN_SIMILARITY = 0.8;

export type FirstSeenStatus = "no_matches" | "unverified" | "first_found";

interface Match {
	articleId: number;
	publishedAt: string | null;
}

async function resolveFirstSeenForArticle(
	articleId: number,
): Promise<{ updated: number; affectedArticleIds: Set<number> }> {
	const affectedArticleIds = new Set<number>();
	const ownClaims = await db
		.select()
		.from(claims)
		.where(eq(claims.articleId, articleId));
	if (ownClaims.length === 0) return { updated: 0, affectedArticleIds };

	const otherClaims = await db
		.select({ id: claims.id, text: claims.text, articleId: claims.articleId })
		.from(claims)
		.where(ne(claims.articleId, articleId));
	const otherArticles = await db
		.select()
		.from(articles)
		.where(ne(articles.id, articleId));
	const dateByArticle = new Map(otherArticles.map((a) => [a.id, a.publishedAt]));
	const [ownArticle] = await db
		.select()
		.from(articles)
		.where(eq(articles.id, articleId));

	let updated = 0;
	for (const claim of ownClaims) {
		const matches: Match[] = [
			{ articleId, publishedAt: ownArticle?.publishedAt ?? null },
		];
		for (const other of otherClaims) {
			if (sentenceSimilarity(claim.text, other.text) >= MIN_SIMILARITY) {
				matches.push({
					articleId: other.articleId,
					publishedAt: dateByArticle.get(other.articleId) ?? null,
				});
				affectedArticleIds.add(other.articleId);
			}
		}

		let status: FirstSeenStatus;
		let firstSeenArticleId: number | null;

		if (matches.length === 1) {
			status = "no_matches";
			firstSeenArticleId = null;
		} else {
			const dated = matches.filter(
				(m) => m.publishedAt && !Number.isNaN(Date.parse(m.publishedAt)),
			);
			if (dated.length === 0) {
				status = "unverified";
				firstSeenArticleId = null;
			} else {
				dated.sort((a, b) => Date.parse(a.publishedAt!) - Date.parse(b.publishedAt!));
				status = "first_found";
				firstSeenArticleId = dated[0].articleId;
			}
		}

		await db
			.update(claims)
			.set({ firstSeenArticleId, firstSeenStatus: status })
			.where(eq(claims.id, claim.id));
		updated++;
	}

	return { updated, affectedArticleIds };
}

export async function buildFirstSeen(articleId: number): Promise<number> {
	const { updated, affectedArticleIds } =
		await resolveFirstSeenForArticle(articleId);
	let total = updated;
	for (const otherId of affectedArticleIds) {
		const result = await resolveFirstSeenForArticle(otherId);
		total += result.updated;
	}
	return total;
}
