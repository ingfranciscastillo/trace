import {
	boolean,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export const todos = pgTable("todos", {
	id: serial().primaryKey(),
	title: text().notNull(),
	createdAt: timestamp("created_at").defaultNow(),
});

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
