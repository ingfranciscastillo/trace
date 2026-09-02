import { eq, inArray, or } from "drizzle-orm";
import { db } from "../db";
import { articles, claimSources, claims, relationships } from "../db/schema";
import {
	type ConfidenceLevel,
	citesConfidence,
	claimConfidence,
	copiedFromConfidence,
} from "./confidence";
import { type DivergenceStatus, computeDivergence } from "./divergence";

export type NodeType = "ARTICLE" | "AUTHOR" | "CLAIM" | "SOURCE" | "ORIGINAL";
export type EdgeKind = "cites" | "authored_by" | "copied_from" | "first_seen_at";

export interface TraceNode {
	id: string;
	type: NodeType;
	title: string;
	url?: string;
	domain?: string;
	date?: string;
	excerpt?: string;
	confidenceLevel?: ConfidenceLevel;
	uncertaintyReasons?: string[];
	divergenceStatus?: DivergenceStatus;
	claimId?: number;
	hasSources?: boolean;
	claimSourceId?: number;
	copiedBy?: number;
	unverified?: boolean;
	firstSeen?: boolean;
	x: number;
	y: number;
}

export interface TraceEdge {
	id: string;
	from: string;
	to: string;
	kind: EdgeKind;
	confidenceLevel?: ConfidenceLevel;
}

export interface TimelineEntry {
	date: string | null;
	label: string;
	domain: string;
}

export interface TraceGraph {
	id: string;
	url: string;
	domain: string;
	title: string;
	author: string | null;
	publishedAt: string | null;
	stats: {
		sources: number;
		claims: number;
		unverified: number;
		firstSeen: string;
	};
	nodes: TraceNode[];
	edges: TraceEdge[];
	timeline: TimelineEntry[];
}

// Claims are ranked unverified-first (the cases that most need scrutiny) and
// capped, since a well-cited article can carry far more claims than a graph
// can usefully display at once.
const MAX_CLAIM_NODES = 12;
const LEVEL_RANK: Record<ConfidenceLevel, number> = {
	unverified: 0,
	low: 1,
	medium: 2,
	high: 3,
};

const COL_WIDTH = 260;
// Tall enough for a fully-wrapped title at MAX_TITLE_LENGTH inside a 208px
// card, plus its type label, meta line, and tags — real titles/claim text
// routinely run past the width of a node, so a short fixed row height causes
// consecutive rows to visually overlap.
const ROW_HEIGHT = 230;
const MAX_TITLE_LENGTH = 100;

function hostnameOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

function truncateTitle(text: string): string {
	return text.length > MAX_TITLE_LENGTH ? `${text.slice(0, MAX_TITLE_LENGTH)}…` : text;
}

export async function buildTraceGraph(articleId: number): Promise<TraceGraph> {
	const [article] = await db.select().from(articles).where(eq(articles.id, articleId));
	if (!article) throw new Error(`Article ${articleId} not found`);

	const articleClaims = await db
		.select()
		.from(claims)
		.where(eq(claims.articleId, articleId));

	const rels = await db
		.select()
		.from(relationships)
		.where(
			or(
				eq(relationships.articleAId, articleId),
				eq(relationships.articleBId, articleId),
			),
		);

	const claimIds = articleClaims.map((c) => c.id);
	const claimSourceRows =
		claimIds.length > 0
			? await db
					.select()
					.from(claimSources)
					.where(inArray(claimSources.claimId, claimIds))
			: [];

	const otherArticleIds = new Set<number>();
	for (const r of rels) {
		otherArticleIds.add(r.articleAId === articleId ? r.articleBId : r.articleAId);
	}
	for (const c of articleClaims) {
		if (c.firstSeenArticleId && c.firstSeenArticleId !== articleId) {
			otherArticleIds.add(c.firstSeenArticleId);
		}
	}
	for (const s of claimSourceRows) {
		if (s.articleId) otherArticleIds.add(s.articleId);
	}

	const otherArticles =
		otherArticleIds.size > 0
			? await db
					.select()
					.from(articles)
					.where(inArray(articles.id, [...otherArticleIds]))
			: [];
	const otherById = new Map(otherArticles.map((a) => [a.id, a]));

	const nodes: TraceNode[] = [];
	const edges: TraceEdge[] = [];
	const rootId = `article-${article.id}`;

	nodes.push({
		id: rootId,
		type: "ARTICLE",
		title: truncateTitle(article.title),
		url: article.url,
		domain: article.domain,
		date: article.publishedAt ?? undefined,
		excerpt: article.excerpt,
		x: 4 * COL_WIDTH,
		y: 0,
	});

	if (article.author) {
		const authorId = `author-${article.id}`;
		nodes.push({
			id: authorId,
			type: "AUTHOR",
			title: article.author,
			x: 6 * COL_WIDTH,
			y: ROW_HEIGHT,
		});
		edges.push({ id: `e-author-${article.id}`, from: rootId, to: authorId, kind: "authored_by" });
	}

	// Neighbor articles: cites (SOURCE) and copied_from (ARTICLE, i.e. a possible
	// republish/copy) — one column per relationship, all on the same row.
	let neighborCol = 0;
	for (const r of rels) {
		const otherId = r.articleAId === articleId ? r.articleBId : r.articleAId;
		const other = otherById.get(otherId);
		if (!other) continue;

		const nodeId = `article-${other.id}`;
		if (!nodes.some((n) => n.id === nodeId)) {
			const isFirstSeenSource = articleClaims.some(
				(c) => c.firstSeenArticleId === other.id,
			);
			nodes.push({
				id: nodeId,
				type: r.type === "cites" ? "SOURCE" : "ARTICLE",
				title: truncateTitle(other.title),
				url: other.url,
				domain: other.domain,
				date: other.publishedAt ?? undefined,
				excerpt: other.excerpt,
				firstSeen: isFirstSeenSource || undefined,
				x: neighborCol * COL_WIDTH,
				y: ROW_HEIGHT,
			});
			neighborCol++;
		}

		const evidence = r.evidence as Record<string, unknown>;
		const confidence =
			r.type === "cites"
				? citesConfidence(Boolean(evidence.isCitation))
				: copiedFromConfidence(
						Number(evidence.sharedSentenceCount ?? 0),
						r.olderArticleId,
					);
		edges.push({
			id: `rel-${r.id}`,
			from: `article-${r.articleAId}`,
			to: `article-${r.articleBId}`,
			kind: r.type as EdgeKind,
			confidenceLevel: confidence.level,
		});
	}

	// Claims, unverified-first, capped — each gets its own column with its
	// discovered sources stacked underneath it.
	const rankedClaims = [...articleClaims].sort((a, b) => {
		const ra = LEVEL_RANK[claimConfidence(a.signals, a.firstSeenStatus).level];
		const rb = LEVEL_RANK[claimConfidence(b.signals, b.firstSeenStatus).level];
		return ra - rb;
	});
	const shownClaims = rankedClaims.slice(0, MAX_CLAIM_NODES);
	const claimRowY = ROW_HEIGHT * 2;

	shownClaims.forEach((claim, col) => {
		const confidence = claimConfidence(claim.signals, claim.firstSeenStatus);
		const nodeId = `claim-${claim.id}`;
		const x = col * COL_WIDTH;
		const ownSources = claimSourceRows.filter((s) => s.claimId === claim.id);

		nodes.push({
			id: nodeId,
			type: "CLAIM",
			title: truncateTitle(claim.text),
			domain: `paragraph ${claim.paragraphIndex}`,
			excerpt: claim.text,
			confidenceLevel: confidence.level,
			uncertaintyReasons: confidence.reasons,
			unverified: confidence.level === "unverified",
			claimId: claim.id,
			hasSources: ownSources.length > 0,
			x,
			y: claimRowY,
		});
		edges.push({ id: `e-claim-${claim.id}`, from: rootId, to: nodeId, kind: "cites" });

		if (claim.firstSeenArticleId && claim.firstSeenArticleId !== articleId) {
			const targetId = `article-${claim.firstSeenArticleId}`;
			if (nodes.some((n) => n.id === targetId)) {
				edges.push({
					id: `e-fs-${claim.id}`,
					from: nodeId,
					to: targetId,
					kind: "first_seen_at",
				});
			}
		}

		ownSources.forEach((s, row) => {
			const sourceNodeId = `csource-${s.id}`;
			const resolved = s.articleId ? otherById.get(s.articleId) : undefined;
			// Divergence needs the source's actual article text — a search-result
			// snippet is too short/unreliable to compare a claim's wording against.
			const divergence = resolved
				? computeDivergence(claim.text, resolved.textContent)
				: undefined;
			nodes.push({
				id: sourceNodeId,
				type: resolved ? "ARTICLE" : "SOURCE",
				title: truncateTitle(resolved?.title ?? s.title),
				url: resolved?.url ?? s.url,
				domain: resolved?.domain ?? hostnameOf(s.url),
				date: (resolved?.publishedAt ?? s.publishedAt) ?? undefined,
				excerpt: resolved?.excerpt ?? s.description,
				divergenceStatus: divergence?.status,
				claimSourceId: resolved ? undefined : s.id,
				x,
				y: claimRowY + ROW_HEIGHT * (row + 1),
			});
			edges.push({
				id: `e-csource-${s.id}`,
				from: nodeId,
				to: sourceNodeId,
				kind: "cites",
			});
		});
	});

	const timelineCandidates: { date: string | null; label: string; domain: string }[] = [
		{ date: article.publishedAt, label: article.title, domain: article.domain },
		...otherArticles.map((a) => ({
			date: a.publishedAt,
			label: a.title,
			domain: a.domain,
		})),
		...claimSourceRows.map((s) => ({
			date: s.publishedAt,
			label: s.title,
			domain: hostnameOf(s.url),
		})),
	];
	const isDated = (t: (typeof timelineCandidates)[number]) =>
		!!t.date && !Number.isNaN(Date.parse(t.date));
	const dedupe = (entries: typeof timelineCandidates) => {
		const seen = new Set<string>();
		return entries.filter((t) => {
			const key = `${t.date ?? ""}|${t.label}|${t.domain}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	};
	const dated = dedupe(timelineCandidates.filter(isDated)).sort(
		(a, b) => Date.parse(a.date!) - Date.parse(b.date!),
	);
	const undated = dedupe(timelineCandidates.filter((t) => !isDated(t))).map(
		(t) => ({ ...t, date: null }),
	);
	// Dated entries first in chronological order, then unknown-date ones flagged
	// separately — never guessed into a position they don't belong.
	const timeline: TimelineEntry[] = [...dated, ...undated];

	const unverifiedCount = articleClaims.filter(
		(c) => claimConfidence(c.signals, c.firstSeenStatus).level === "unverified",
	).length;

	return {
		id: String(article.id),
		url: article.url,
		domain: article.domain,
		title: article.title,
		author: article.author,
		publishedAt: article.publishedAt,
		stats: {
			sources: otherArticles.length + claimSourceRows.length,
			claims: articleClaims.length,
			unverified: unverifiedCount,
			firstSeen: timeline[0]?.date ?? "unknown",
		},
		nodes,
		edges,
		timeline,
	};
}
