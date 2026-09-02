import { and, eq, inArray, ne, or } from "drizzle-orm";
import { db } from "../db";
import { articles, links, relationships } from "../db/schema";
import { compareArticleText } from "./detectCopies";

const MIN_SHARED_SENTENCES = 2;

type Article = typeof articles.$inferSelect;

function resolveOlderArticle(a: Article, b: Article): number | null {
	if (!a.publishedAt || !b.publishedAt) return null;
	const dateA = Date.parse(a.publishedAt);
	const dateB = Date.parse(b.publishedAt);
	if (Number.isNaN(dateA) || Number.isNaN(dateB) || dateA === dateB) return null;
	return dateA < dateB ? a.id : b.id;
}

export async function resolveCites(articleId: number): Promise<number> {
	const articleLinks = await db
		.select()
		.from(links)
		.where(eq(links.articleId, articleId));

	await db
		.delete(relationships)
		.where(
			and(eq(relationships.type, "cites"), eq(relationships.articleAId, articleId)),
		);

	if (articleLinks.length === 0) return 0;

	const hrefs = [...new Set(articleLinks.map((l) => l.href))];
	const matches = await db
		.select({ id: articles.id, url: articles.url })
		.from(articles)
		.where(and(inArray(articles.url, hrefs), ne(articles.id, articleId)));

	if (matches.length === 0) return 0;

	const urlToId = new Map(matches.map((m) => [m.url, m.id]));
	const rows = articleLinks
		.filter((l) => urlToId.has(l.href))
		.map((l) => ({
			articleAId: articleId,
			articleBId: urlToId.get(l.href)!,
			type: "cites",
			olderArticleId: null,
			evidence: { href: l.href, anchorText: l.text, isCitation: l.isCitation },
		}));

	if (rows.length === 0) return 0;
	await db.insert(relationships).values(rows).onConflictDoNothing();
	return rows.length;
}

export async function resolveIncomingCites(
	articleId: number,
	url: string,
): Promise<number> {
	const incoming = await db
		.select()
		.from(links)
		.where(and(eq(links.href, url), ne(links.articleId, articleId)));

	if (incoming.length === 0) return 0;

	const rows = incoming.map((l) => ({
		articleAId: l.articleId,
		articleBId: articleId,
		type: "cites",
		olderArticleId: null,
		evidence: { href: l.href, anchorText: l.text, isCitation: l.isCitation },
	}));

	await db.insert(relationships).values(rows).onConflictDoNothing();
	return rows.length;
}

export async function detectCopiesAgainstCorpus(
	articleId: number,
): Promise<number> {
	const [current] = await db
		.select()
		.from(articles)
		.where(eq(articles.id, articleId));
	if (!current) return 0;

	await db
		.delete(relationships)
		.where(
			and(
				eq(relationships.type, "copied_from"),
				or(
					eq(relationships.articleAId, articleId),
					eq(relationships.articleBId, articleId),
				),
			),
		);

	const others = await db
		.select()
		.from(articles)
		.where(ne(articles.id, articleId));
	if (others.length === 0) return 0;

	let created = 0;
	for (const other of others) {
		const shared = compareArticleText(current.textContent, other.textContent);
		if (shared.length < MIN_SHARED_SENTENCES) continue;

		const [articleAId, articleBId] = [current.id, other.id].sort(
			(a, b) => a - b,
		);
		const olderArticleId = resolveOlderArticle(current, other);

		await db
			.insert(relationships)
			.values({
				articleAId,
				articleBId,
				type: "copied_from",
				olderArticleId,
				evidence: {
					sharedSentenceCount: shared.length,
					samples: shared.slice(0, 5),
				},
			})
			.onConflictDoNothing();
		created++;
	}
	return created;
}

export interface RelationshipCounts {
	citesOut: number;
	citesIn: number;
	copies: number;
}

export async function buildRelationships(
	articleId: number,
	url: string,
): Promise<RelationshipCounts> {
	const citesOut = await resolveCites(articleId);
	const citesIn = await resolveIncomingCites(articleId, url);
	const copies = await detectCopiesAgainstCorpus(articleId);
	return { citesOut, citesIn, copies };
}
