import { eq } from "drizzle-orm";
import { db } from "../db";
import { articles, claimSources, claims } from "../db/schema";
import { findExternalSourcesForClaim, type SearchResult } from "./braveSearch";
import { extractArticleImpl } from "./extractArticle.functions";
import { saveArticle } from "./articleStore";

const MAX_RESULTS_PER_CLAIM = 3;

// How many hops from a user-submitted root a discovered source may be saved at.
// Kept small on purpose: each level can fan out into more searches and fetches.
export const MAX_CHAIN_DEPTH = 2;

// One Brave Search call, scoped to a single claim. Never called automatically —
// the caller decides which claims are worth spending a request on.
export async function findSourcesForClaim(claimId: number): Promise<SearchResult> {
	const [claim] = await db.select().from(claims).where(eq(claims.id, claimId));
	if (!claim) throw new Error(`Claim ${claimId} not found`);

	const result = await findExternalSourcesForClaim(claim.text);
	if (!result.ok) return result;

	const top = result.results.slice(0, MAX_RESULTS_PER_CLAIM);
	if (top.length > 0) {
		await db
			.insert(claimSources)
			.values(
				top.map((r) => ({
					claimId,
					url: r.url,
					title: r.title,
					description: r.description,
					publishedAt: r.publishedAt,
				})),
			)
			.onConflictDoNothing();
	}

	return { ok: true, results: top };
}

export type ResolveClaimSourceStatus =
	| "linked_existing"
	| "extracted"
	| "depth_exceeded"
	| "extract_failed";

export interface ResolveClaimSourceResult {
	status: ResolveClaimSourceStatus;
	articleId: number | null;
}

// Extracts and saves ONE discovered source into the corpus — a single real HTTP
// fetch, no cascading. Depth-capped and dedup-by-URL, so re-resolving a source
// that cites back into the existing corpus links to it instead of re-fetching
// or recursing (this is the cycle/duplicate guard the spec asks for).
export async function resolveClaimSource(
	claimSourceId: number,
): Promise<ResolveClaimSourceResult> {
	const [source] = await db
		.select()
		.from(claimSources)
		.where(eq(claimSources.id, claimSourceId));
	if (!source) throw new Error(`Claim source ${claimSourceId} not found`);

	const [existing] = await db
		.select()
		.from(articles)
		.where(eq(articles.url, source.url));
	if (existing) {
		await db
			.update(claimSources)
			.set({ articleId: existing.id })
			.where(eq(claimSources.id, claimSourceId));
		return { status: "linked_existing", articleId: existing.id };
	}

	const [claim] = await db.select().from(claims).where(eq(claims.id, source.claimId));
	const [parentArticle] = await db
		.select()
		.from(articles)
		.where(eq(articles.id, claim.articleId));

	const nextDepth = parentArticle.depth + 1;
	if (nextDepth > MAX_CHAIN_DEPTH) {
		return { status: "depth_exceeded", articleId: null };
	}

	const extracted = await extractArticleImpl(source.url);
	if (!extracted.ok) return { status: "extract_failed", articleId: null };

	const { articleId } = await saveArticle(extracted, nextDepth);
	await db
		.update(claimSources)
		.set({ articleId })
		.where(eq(claimSources.id, claimSourceId));
	return { status: "extracted", articleId };
}
