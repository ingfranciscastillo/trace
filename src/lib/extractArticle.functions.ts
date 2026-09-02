import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { z } from "zod";

export interface ExtractLink {
	href: string;
	text: string;
	isExternal: boolean;
}

export interface ExtractOk {
	ok: true;
	url: string;
	domain: string;
	title: string;
	author: string | null;
	publishedAt: string | null;
	excerpt: string;
	textLength: number;
	links: ExtractLink[];
}

export interface ExtractError {
	ok: false;
	url: string;
	domain: string;
	error: "fetch_failed" | "not_html" | "no_article_content";
}

export type ExtractResult = ExtractOk | ExtractError;

export const extractUrlSchema = z.string().refine((value) => {
	try {
		const parsed = new URL(value);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}, "Must be a valid http or https URL");

function domainFromUrl(url: string): string {
	return new URL(url).hostname.replace(/^www\./, "");
}

interface FetchHtmlOk {
	ok: true;
	html: string;
	finalUrl: string;
}

interface FetchHtmlError {
	ok: false;
	error: "fetch_failed" | "not_html";
}

async function fetchHtml(
	url: string,
): Promise<FetchHtmlOk | FetchHtmlError> {
	let response: Response;
	try {
		response = await fetch(url, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (compatible; TraceBot/0.1; +https://trace.example/bot)",
			},
			signal: AbortSignal.timeout(10_000),
			redirect: "follow",
		});
	} catch {
		return { ok: false, error: "fetch_failed" };
	}

	if (!response.ok) {
		return { ok: false, error: "fetch_failed" };
	}

	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("text/html")) {
		return { ok: false, error: "not_html" };
	}

	const html = await response.text();
	return { ok: true, html, finalUrl: response.url || url };
}

function buildDocument(html: string, url: string): Document {
	const dom = new JSDOM(html, { url });
	return dom.window.document;
}

interface MetaFallback {
	title: string | null;
	author: string | null;
	publishedAt: string | null;
}

function extractMetaFallback(document: Document): MetaFallback {
	const ogTitle = document
		.querySelector('meta[property="og:title"]')
		?.getAttribute("content");
	const titleTag = document.querySelector("title")?.textContent;
	const metaAuthor = document
		.querySelector('meta[name="author"]')
		?.getAttribute("content");
	const metaPublished = document
		.querySelector('meta[property="article:published_time"]')
		?.getAttribute("content");
	const timeEl = document
		.querySelector("time[datetime]")
		?.getAttribute("datetime");

	return {
		title: ogTitle?.trim() || titleTag?.trim() || null,
		author: metaAuthor?.trim() || null,
		publishedAt: metaPublished?.trim() || timeEl?.trim() || null,
	};
}

interface ParsedArticle {
	title: string;
	author: string | null;
	publishedAt: string | null;
	contentHtml: string;
	textContent: string;
}

function parseReadableArticle(
	document: Document,
	meta: MetaFallback,
): ParsedArticle | null {
	const reader = new Readability(document);
	const article = reader.parse();

	if (
		!article ||
		!article.textContent ||
		article.textContent.trim().length === 0
	) {
		return null;
	}

	return {
		title: article.title?.trim() || meta.title || "Untitled",
		author: article.byline?.trim() || meta.author || null,
		publishedAt: meta.publishedAt,
		contentHtml: article.content ?? "",
		textContent: article.textContent.trim(),
	};
}

export const __internal = {
	fetchHtml,
	buildDocument,
	extractMetaFallback,
	parseReadableArticle,
};
