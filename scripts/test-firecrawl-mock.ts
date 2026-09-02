import assert from "node:assert/strict";
import { firecrawlFetch, isFirecrawlEnabled } from "../src/lib/firecrawl";

function mockFetch(status: number, body: unknown) {
	global.fetch = (async () =>
		new Response(JSON.stringify(body), {
			status,
			headers: { "content-type": "application/json" },
		})) as typeof fetch;
}

// Switch off (default): never enabled, never calls fetch, regardless of key.
delete process.env.FIRECRAWL_ENABLED;
delete process.env.FIRECRAWL_API_KEY;
assert.equal(isFirecrawlEnabled(), false);
let fetchCalled = false;
global.fetch = (async () => {
	fetchCalled = true;
	throw new Error("should not be called");
}) as typeof fetch;
const off = await firecrawlFetch("https://example.com/article");
assert.equal(off.ok, false);
if (!off.ok) assert.equal(off.error, "not_configured");
assert.equal(fetchCalled, false);
console.log("PASS: switch off -> not_configured, no network call");

// Switch on but no key: still not an active session.
process.env.FIRECRAWL_ENABLED = "true";
delete process.env.FIRECRAWL_API_KEY;
assert.equal(isFirecrawlEnabled(), false);
console.log("PASS: switch on without API key -> still disabled");

// Switch on + key: enabled, parses a successful scrape response.
process.env.FIRECRAWL_API_KEY = "fake-key-for-mock-test";
assert.equal(isFirecrawlEnabled(), true);
mockFetch(200, {
	success: true,
	data: {
		rawHtml: "<html><body>real page</body></html>",
		metadata: { sourceURL: "https://example.com/article" },
	},
});
const ok = await firecrawlFetch("https://example.com/article");
assert.equal(ok.ok, true);
if (ok.ok) {
	assert.equal(ok.html, "<html><body>real page</body></html>");
	assert.equal(ok.finalUrl, "https://example.com/article");
}
console.log("PASS: switch on + key -> parses successful scrape");

// Error mapping.
mockFetch(401, {});
const unauthorized = await firecrawlFetch("https://example.com/article");
assert.equal(unauthorized.ok, false);
if (!unauthorized.ok) assert.equal(unauthorized.error, "unauthorized");
console.log("PASS: 401 -> unauthorized");

mockFetch(429, {});
const rateLimited = await firecrawlFetch("https://example.com/article");
assert.equal(rateLimited.ok, false);
if (!rateLimited.ok) assert.equal(rateLimited.error, "rate_limited");
console.log("PASS: 429 -> rate_limited");

mockFetch(200, { success: false });
const noHtml = await firecrawlFetch("https://example.com/article");
assert.equal(noHtml.ok, false);
if (!noHtml.ok) assert.equal(noHtml.error, "request_failed");
console.log("PASS: success:false / missing html -> request_failed");

delete process.env.FIRECRAWL_ENABLED;
delete process.env.FIRECRAWL_API_KEY;
console.log("\nAll Firecrawl mock tests passed. No real Firecrawl requests were made.");
