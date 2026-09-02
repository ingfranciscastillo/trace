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

export const __internal = { fetchHtml };
