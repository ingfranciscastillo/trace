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
