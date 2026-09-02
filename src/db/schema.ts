import {
	boolean,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const articles = pgTable("articles", {
	id: serial().primaryKey(),
	url: text().notNull().unique(),
	domain: text().notNull(),
	title: text().notNull(),
	author: text(),
	publishedAt: text("published_at"),
	excerpt: text().notNull(),
	textContent: text("text_content").notNull(),
	textLength: integer("text_length").notNull(),
	fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
	// 0 = submitted directly by a user. N+1 = discovered while chasing a source
	// N hops away. Caps how far automatic source-chasing is allowed to go.
	depth: integer().notNull().default(0),
});

// Unique on (articleId, text) so re-saving an article can upsert claims in place
// instead of deleting and reinserting — a claim's id must survive re-extraction,
// since other rows (claim_sources) reference it by id.
export const claims = pgTable(
	"claims",
	{
		id: serial().primaryKey(),
		articleId: integer("article_id")
			.notNull()
			.references(() => articles.id, { onDelete: "cascade" }),
		text: text().notNull(),
		paragraphIndex: integer("paragraph_index").notNull(),
		signals: text().array().notNull(),
		// "no_matches": unique to this article, nothing to compare against.
		// "unverified": matching claims exist elsewhere but none have a usable date.
		// "first_found": earliest dated occurrence among corpus matches — never "confirmed
		// origin", since an earlier undiscovered source can always exist outside the corpus.
		firstSeenArticleId: integer("first_seen_article_id").references(
			() => articles.id,
			{ onDelete: "set null" },
		),
		firstSeenStatus: text("first_seen_status"),
	},
	(t) => [uniqueIndex("claims_article_text_idx").on(t.articleId, t.text)],
);

export const links = pgTable("links", {
	id: serial().primaryKey(),
	articleId: integer("article_id")
		.notNull()
		.references(() => articles.id, { onDelete: "cascade" }),
	href: text().notNull(),
	text: text().notNull(),
	isExternal: boolean("is_external").notNull(),
	isCitation: boolean("is_citation").notNull(),
});

// For "cites": articleAId is the citing article, articleBId is the cited one (directional).
// For "copied_from": the pair is unordered (articleAId < articleBId); olderArticleId names
// whichever side is chronologically earlier, or null when dates are missing/equal —
// i.e. "possible copy detected" vs "copy direction confirmed".
export const relationships = pgTable(
	"relationships",
	{
		id: serial().primaryKey(),
		articleAId: integer("article_a_id")
			.notNull()
			.references(() => articles.id, { onDelete: "cascade" }),
		articleBId: integer("article_b_id")
			.notNull()
			.references(() => articles.id, { onDelete: "cascade" }),
		type: text().notNull(),
		olderArticleId: integer("older_article_id").references(
			() => articles.id,
			{ onDelete: "set null" },
		),
		evidence: jsonb().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [uniqueIndex("relationships_pair_type_idx").on(t.articleAId, t.articleBId, t.type)],
);

// One row per (user, article) they've traced. History is opt-in by nature of
// requiring a session — an anonymous visitor's trace never gets recorded here,
// and never shows up for anyone else. articleId points at the shared corpus;
// this table only tracks who has personally looked at which of it.
export const searches = pgTable(
	"searches",
	{
		id: serial().primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		articleId: integer("article_id")
			.notNull()
			.references(() => articles.id, { onDelete: "cascade" }),
		searchedAt: timestamp("searched_at").defaultNow().notNull(),
	},
	(t) => [uniqueIndex("searches_user_article_idx").on(t.userId, t.articleId)],
);

// A candidate external source found via web search for a specific claim.
// articleId stays null until resolveClaimSource actually extracts and saves it
// into the corpus (or links it to an existing article at the same URL).
export const claimSources = pgTable(
	"claim_sources",
	{
		id: serial().primaryKey(),
		claimId: integer("claim_id")
			.notNull()
			.references(() => claims.id, { onDelete: "cascade" }),
		url: text().notNull(),
		title: text().notNull(),
		description: text().notNull(),
		publishedAt: text("published_at"),
		articleId: integer("article_id").references(() => articles.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [uniqueIndex("claim_sources_claim_url_idx").on(t.claimId, t.url)],
);
