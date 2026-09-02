export interface FirecrawlOk {
	ok: true;
	html: string;
	finalUrl: string;
}

export interface FirecrawlError {
	ok: false;
	error: "not_configured" | "unauthorized" | "rate_limited" | "request_failed";
}

export type FirecrawlResult = FirecrawlOk | FirecrawlError;

const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v1/scrape";

// The switch (FIRECRAWL_ENABLED) is only ever honored alongside a real API
// key — flipping it on without a configured session does nothing, rather
// than failing loudly at request time.
export function isFirecrawlEnabled(): boolean {
	return process.env.FIRECRAWL_ENABLED === "true" && !!process.env.FIRECRAWL_API_KEY;
}

interface FirecrawlResponse {
	success?: boolean;
	data?: {
		html?: string;
		rawHtml?: string;
		metadata?: { sourceURL?: string };
	};
}

export async function firecrawlFetch(url: string): Promise<FirecrawlResult> {
	if (!isFirecrawlEnabled()) return { ok: false, error: "not_configured" };
	const apiKey = process.env.FIRECRAWL_API_KEY!;

	let response: Response;
	try {
		response = await fetch(FIRECRAWL_SCRAPE_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({ url, formats: ["rawHtml", "html"] }),
			signal: AbortSignal.timeout(30_000),
		});
	} catch {
		return { ok: false, error: "request_failed" };
	}

	if (response.status === 401 || response.status === 403) {
		await response.body?.cancel();
		return { ok: false, error: "unauthorized" };
	}
	if (response.status === 429) {
		await response.body?.cancel();
		return { ok: false, error: "rate_limited" };
	}
	if (!response.ok) {
		await response.body?.cancel();
		return { ok: false, error: "request_failed" };
	}

	let data: FirecrawlResponse;
	try {
		data = await response.json();
	} catch {
		return { ok: false, error: "request_failed" };
	}

	const html = data.data?.rawHtml ?? data.data?.html;
	if (!data.success || !html) return { ok: false, error: "request_failed" };

	return { ok: true, html, finalUrl: data.data?.metadata?.sourceURL ?? url };
}
