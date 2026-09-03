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

// Fixed-window usage counters for anything that costs real money per call
// (Brave Search, Firecrawl). subject is "user:<id>" once signed in, or
// "ip:<address>" for anonymous callers — anonymous never gets a Firecrawl
// counter since that path requires a session outright. periodStart is the
// truncated start of the counting window (UTC day for anonymous, UTC month
// for signed-in), so a fresh row per window is just a new periodStart value.
export const usageCounters = pgTable(
	"usage_counters",
	{
		id: serial().primaryKey(),
		subject: text().notNull(),
		resource: text().notNull(),
		periodStart: timestamp("period_start").notNull(),
		count: integer().notNull().default(0),
	},
	(t) => [
		uniqueIndex("usage_counters_subject_resource_period_idx").on(
			t.subject,
			t.resource,
			t.periodStart,
		),
	],
);

// Current spendable balance per user. Maintained alongside creditTransactions
// (not derived by summing it on read) so a spend can be a single row-locked
// read-check-decrement — summing an append-only ledger under concurrent
// spends would race and could let the balance go negative.
export const creditBalances = pgTable("credit_balances", {
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	balance: integer().notNull().default(0),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Append-only audit log: positive amount = purchase, -1 = one spend. Purchases
// carry the Dodo payment id so a retried webhook can't double-credit — the
// unique index makes a duplicate insert a no-op instead of a second credit.
export const creditTransactions = pgTable(
	"credit_transactions",
	{
		id: serial().primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		amount: integer().notNull(),
		reason: text().notNull(),
		dodoPaymentId: text("dodo_payment_id"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [uniqueIndex("credit_transactions_dodo_payment_idx").on(t.dodoPaymentId)],
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
