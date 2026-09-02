export interface WebSearchResult {
	title: string;
	url: string;
	description: string;
	publishedAt: string | null;
}

export interface SearchOk {
	ok: true;
	results: WebSearchResult[];
}

export interface SearchError {
	ok: false;
	error: "missing_api_key" | "unauthorized" | "rate_limited" | "request_failed";
}

export type SearchResult = SearchOk | SearchError;

const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";

interface BraveWebResult {
	title?: string;
	url?: string;
	description?: string;
	page_age?: string;
	age?: string;
}

interface BraveResponse {
	web?: { results?: BraveWebResult[] };
}

export async function searchWeb(query: string, count = 5): Promise<SearchResult> {
	const apiKey = process.env.BRAVE_SEARCH_API_KEY;
	if (!apiKey) return { ok: false, error: "missing_api_key" };

	const url = new URL(BRAVE_SEARCH_URL);
	url.searchParams.set("q", query);
	url.searchParams.set("count", String(count));

	let response: Response;
	try {
		response = await fetch(url, {
			headers: {
				Accept: "application/json",
				"X-Subscription-Token": apiKey,
			},
			signal: AbortSignal.timeout(10_000),
		});
	} catch {
		return { ok: false, error: "request_failed" };
	}

	if (response.status === 401 || response.status === 403) {
		return { ok: false, error: "unauthorized" };
	}
	if (response.status === 429) {
		return { ok: false, error: "rate_limited" };
	}
	if (!response.ok) {
		return { ok: false, error: "request_failed" };
	}

	let data: BraveResponse;
	try {
		data = await response.json();
	} catch {
		return { ok: false, error: "request_failed" };
	}

	const results: WebSearchResult[] = (data.web?.results ?? []).map((r) => ({
		title: r.title?.trim() ?? "",
		url: r.url ?? "",
		description: r.description?.trim() ?? "",
		publishedAt: r.page_age ?? r.age ?? null,
	}));

	return { ok: true, results };
}

export function findExternalSourcesForClaim(claimText: string): Promise<SearchResult> {
	const query = claimText.replace(/\[\d+\]/g, "").trim().slice(0, 300);
	return searchWeb(query);
}
