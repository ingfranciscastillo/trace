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
});

export const claims = pgTable("claims", {
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
});

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
