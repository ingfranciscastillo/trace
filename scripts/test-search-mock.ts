import assert from "node:assert/strict";
import { searchWeb } from "../src/lib/braveSearch";

const originalFetch = global.fetch;

function mockFetch(status: number, body: unknown) {
	global.fetch = (async () =>
		new Response(JSON.stringify(body), {
			status,
			headers: { "content-type": "application/json" },
		})) as typeof fetch;
}

process.env.BRAVE_SEARCH_API_KEY = "fake-key-for-mock-test";

// Happy path: parses title/url/description/publishedAt from a realistic response shape.
mockFetch(200, {
	web: {
		results: [
			{
				title: "Example Study on Widgets",
				url: "https://example.org/widgets-study",
				description: "A peer-reviewed study on widgets.",
				page_age: "2024-03-01T00:00:00",
			},
			{
				title: "No date result",
				url: "https://example.org/no-date",
				description: "Missing page_age and age.",
			},
		],
	},
});
const ok = await searchWeb("widgets study");
assert.equal(ok.ok, true);
if (ok.ok) {
	assert.equal(ok.results.length, 2);
	assert.equal(ok.results[0].title, "Example Study on Widgets");
	assert.equal(ok.results[0].url, "https://example.org/widgets-study");
	assert.equal(ok.results[0].publishedAt, "2024-03-01T00:00:00");
	assert.equal(ok.results[1].publishedAt, null);
}
console.log("PASS: parses results, missing publishedAt falls back to null");

// Missing API key never hits the network.
delete process.env.BRAVE_SEARCH_API_KEY;
let fetchCalled = false;
global.fetch = (async () => {
	fetchCalled = true;
	throw new Error("should not be called");
}) as typeof fetch;
const noKey = await searchWeb("anything");
assert.equal(noKey.ok, false);
if (!noKey.ok) assert.equal(noKey.error, "missing_api_key");
assert.equal(fetchCalled, false);
console.log("PASS: missing_api_key short-circuits before any fetch");

process.env.BRAVE_SEARCH_API_KEY = "fake-key-for-mock-test";

// Status code -> error mapping.
mockFetch(401, {});
const unauthorized = await searchWeb("q");
assert.equal(unauthorized.ok, false);
if (!unauthorized.ok) assert.equal(unauthorized.error, "unauthorized");
console.log("PASS: 401 -> unauthorized");

mockFetch(429, {});
const rateLimited = await searchWeb("q");
assert.equal(rateLimited.ok, false);
if (!rateLimited.ok) assert.equal(rateLimited.error, "rate_limited");
console.log("PASS: 429 -> rate_limited");

mockFetch(500, {});
const failed = await searchWeb("q");
assert.equal(failed.ok, false);
if (!failed.ok) assert.equal(failed.error, "request_failed");
console.log("PASS: 500 -> request_failed");

global.fetch = originalFetch;
console.log("\nAll mock tests passed. No real Brave Search requests were made.");
