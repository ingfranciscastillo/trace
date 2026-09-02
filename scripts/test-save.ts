import { eq, or } from "drizzle-orm";
import { db } from "../src/db";
import { articles, claims, links, relationships } from "../src/db/schema";
import { extractArticleImpl } from "../src/lib/extractArticle.functions";
import { saveArticle } from "../src/lib/articleStore";
import {
	citesConfidence,
	claimConfidence,
	copiedFromConfidence,
} from "../src/lib/confidence";

const url = process.argv[2];

if (!url) {
	console.error("Usage: tsx scripts/test-save.ts <url>");
	process.exit(1);
}

const result = await extractArticleImpl(url);

if (!result.ok) {
	console.error("Extraction failed:", result.error);
	process.exit(1);
}

const { articleId, relationships: relCounts, firstSeenUpdated } =
	await saveArticle(result);
console.log("Saved article id:", articleId);
console.log("Relationships built:", relCounts);
console.log("First-seen claims updated (this + affected articles):", firstSeenUpdated);

const [storedArticle] = await db
	.select()
	.from(articles)
	.where(eq(articles.id, articleId));
console.log("Stored article:", storedArticle);

const storedClaims = await db
	.select()
	.from(claims)
	.where(eq(claims.articleId, articleId));
console.log("Stored claims:", storedClaims.length);
for (const claim of storedClaims) {
	const confidence = claimConfidence(claim.signals, claim.firstSeenStatus);
	console.log(
		" ",
		`[${confidence.level}${confidence.reasons.length ? " " + confidence.reasons.join(",") : ""}]`,
		`(${claim.firstSeenStatus ?? "?"})`,
		"-",
		claim.text.slice(0, 80),
	);
}

const storedLinks = await db
	.select()
	.from(links)
	.where(eq(links.articleId, articleId));
console.log(
	"Stored links:",
	storedLinks.length,
	"(citations:",
	storedLinks.filter((l) => l.isCitation).length,
	")",
);

const storedRelationships = await db
	.select()
	.from(relationships)
	.where(
		or(
			eq(relationships.articleAId, articleId),
			eq(relationships.articleBId, articleId),
		),
	);
console.log("Stored relationships:", storedRelationships.length);
for (const rel of storedRelationships) {
	const evidence = rel.evidence as Record<string, unknown>;
	const confidence =
		rel.type === "cites"
			? citesConfidence(Boolean(evidence.isCitation))
			: copiedFromConfidence(
					Number(evidence.sharedSentenceCount ?? 0),
					rel.olderArticleId,
				);
	console.log(
		" ",
		rel.type,
		rel.articleAId,
		"->",
		rel.articleBId,
		`[${confidence.level}${confidence.reasons.length ? " " + confidence.reasons.join(",") : ""}]`,
		evidence,
	);
}

process.exit(0);
