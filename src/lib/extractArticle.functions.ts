import { Readability } from "@mozilla/readability";
import { createServerFn } from "@tanstack/react-start";
import { JSDOM } from "jsdom";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { z } from "zod";
import { analyzeContent, type Claim } from "./extractClaims";

export interface ExtractLink {
	href: string;
	text: string;
	isExternal: boolean;
	isCitation: boolean;
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
	claims: Claim[];
}

export interface ExtractError {
	ok: false;
	url: string;
	domain: string;
	error: "fetch_failed" | "not_html" | "no_article_content" | "blocked";
}

export type ExtractResult = ExtractOk | ExtractError;

function isPrivateOrReservedIp(ip: string): boolean {
	const version = isIP(ip);

	if (version === 4) {
		const [a, b] = ip.split(".").map(Number);
		if (a === 10) return true;
		if (a === 127) return true;
		if (a === 0) return true;
		if (a === 169 && b === 254) return true;
		if (a === 172 && b >= 16 && b <= 31) return true;
		if (a === 192 && b === 168) return true;
		if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
		if (a >= 224) return true; // multicast / reserved
		return false;
	}

	if (version === 6) {
		const normalized = ip.toLowerCase();
		if (normalized === "::1") return true;
		if (normalized.startsWith("::ffff:")) {
			const mapped = normalized.slice("::ffff:".length);
			return isIP(mapped) === 4 ? isPrivateOrReservedIp(mapped) : false;
		}
		if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
			return true; // fc00::/7 unique local
		}
		if (/^fe[89ab]/.test(normalized)) return true; // fe80::/10 link-local
		return false;
	}

	return false;
}

function isDangerousHostname(hostname: string): boolean {
	const lower = hostname.toLowerCase();
	if (lower === "localhost" || lower.endsWith(".localhost")) return true;

	const ipVersion = isIP(lower);
	if (ipVersion) return isPrivateOrReservedIp(lower);

	return false;
}

export const extractUrlSchema = z.string().refine((value) => {
	try {
		const parsed = new URL(value);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return false;
		}
		return !isDangerousHostname(parsed.hostname);
	} catch {
		return false;
	}
}, "Must be a valid, non-internal http or https URL");

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
	error: "fetch_failed" | "not_html" | "blocked";
}

const MAX_REDIRECTS = 5;

async function fetchHtml(
	url: string,
): Promise<FetchHtmlOk | FetchHtmlError> {
	let currentUrl = url;

	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const hostname = new URL(currentUrl).hostname;

		if (isDangerousHostname(hostname)) {
			return { ok: false, error: "blocked" };
		}

		let resolvedIp: string;
		try {
			resolvedIp = (await lookup(hostname)).address;
		} catch {
			return { ok: false, error: "fetch_failed" };
		}
		if (isPrivateOrReservedIp(resolvedIp)) {
			return { ok: false, error: "blocked" };
		}

		let response: Response;
		try {
			response = await fetch(currentUrl, {
				headers: {
					"User-Agent":
						"Mozilla/5.0 (compatible; TraceBot/0.1; +https://trace.example/bot)",
				},
				signal: AbortSignal.timeout(10_000),
				redirect: "manual",
			});
		} catch {
			return { ok: false, error: "fetch_failed" };
		}

		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get("location");
			if (!location) {
				return { ok: false, error: "fetch_failed" };
			}
			currentUrl = new URL(location, currentUrl).href;
			continue;
		}

		if (!response.ok) {
			return { ok: false, error: "fetch_failed" };
		}

		const contentType = response.headers.get("content-type") ?? "";
		if (!contentType.includes("text/html")) {
			return { ok: false, error: "not_html" };
		}

		const html = await response.text();
		return { ok: true, html, finalUrl: currentUrl };
	}

	return { ok: false, error: "fetch_failed" };
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

function extractLinks(
	contentHtml: string,
	baseUrl: string,
	domain: string,
): ExtractLink[] {
	if (!contentHtml) return [];

	const dom = new JSDOM(contentHtml, { url: baseUrl });
	const anchors = Array.from(
		dom.window.document.querySelectorAll("a[href]"),
	);

	const seen = new Set<string>();
	const links: ExtractLink[] = [];

	for (const anchor of anchors) {
		const rawHref = anchor.getAttribute("href");
		if (!rawHref) continue;

		let resolved: URL;
		try {
			resolved = new URL(rawHref, baseUrl);
		} catch {
			continue;
		}

		if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
			continue;
		}

		const href = resolved.href;
		if (seen.has(href)) continue;
		seen.add(href);

		links.push({
			href,
			text: anchor.textContent?.trim() ?? "",
			isExternal: resolved.hostname.replace(/^www\./, "") !== domain,
			isCitation: false,
		});
	}

	return links;
}

export async function extractArticleImpl(
	rawUrl: string,
): Promise<ExtractResult> {
	const parsed = extractUrlSchema.safeParse(rawUrl);
	if (!parsed.success) {
		throw new Error(`Invalid URL: ${rawUrl}`);
	}
	const url = parsed.data;
	const domain = domainFromUrl(url);

	const fetched = await fetchHtml(url);
	if (!fetched.ok) {
		return { ok: false, url, domain, error: fetched.error };
	}

	const document = buildDocument(fetched.html, fetched.finalUrl);
	const meta = extractMetaFallback(document);
	const article = parseReadableArticle(document, meta);

	if (!article) {
		return { ok: false, url, domain, error: "no_article_content" };
	}

	const links = extractLinks(article.contentHtml, fetched.finalUrl, domain);
	const { claims, citationHrefs } = analyzeContent(
		article.contentHtml,
		fetched.finalUrl,
	);
	const linksWithCitations = links.map((link) => ({
		...link,
		isCitation: citationHrefs.has(link.href),
	}));

	return {
		ok: true,
		url,
		domain,
		title: article.title,
		author: article.author,
		publishedAt: article.publishedAt,
		excerpt: article.textContent.slice(0, 500),
		textLength: article.textContent.length,
		links: linksWithCitations,
		claims,
	};
}

export const extractArticle = createServerFn({ method: "GET" })
	.validator((data: unknown) => extractUrlSchema.parse(data))
	.handler(async ({ data }) => extractArticleImpl(data));
