# Trace Extraction Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Given a URL, fetch the page and extract clean article text, metadata, and outbound links, as a standalone server-side module — no persistence, no UI wiring.

**Architecture:** One new server function file (`src/lib/extractArticle.functions.ts`) built bottom-up: URL validation → HTTP fetch → jsdom parse → meta-tag fallback extraction → Readability article extraction → link extraction → assembly into a discriminated-union result. A CLI harness (`scripts/test-extract.ts`) grows alongside it for manual verification against real URLs (no test framework is installed, and the spec deliberately doesn't add one for a single function).

**Tech Stack:** TanStack Start (`createServerFn`), `zod`, `jsdom`, `@mozilla/readability`, `tsx` (already a devDependency, used to run the CLI harness).

**Spec:** `docs/superpowers/specs/2026-09-02-trace-extraction-pipeline-design.md`

## Global Constraints

- No changes to `src/lib/traceData.ts`, `src/routes/trace.tsx`, or `src/db/schema.ts` — this phase is fully isolated (per spec's Non-goals).
- No new test framework — verification is manual, via `scripts/test-extract.ts` run with `tsx` (per spec's Testing section).
- No step throws for expected failure modes (network errors, wrong content-type, unparseable article) — these map to `{ ok: false, error: ... }`, never a thrown exception (per spec's Error handling).
- Fetch timeout ~10s via `AbortSignal.timeout`; a realistic `User-Agent` header is required (per spec step 2).
- Links are collected only from Readability's cleaned article content, not the raw document (per spec step 7).

---

### Task 1: Add dependencies

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing
- Produces: `jsdom`, `@mozilla/readability` importable from any file in the project; `@types/jsdom` available for TypeScript

- [x] **Step 1: Install runtime and type dependencies**

Run:
```bash
pnpm add jsdom @mozilla/readability
pnpm add -D @types/jsdom
```

- [x] **Step 2: Verify the packages resolve**

Run:
```bash
node -e "console.log(Object.keys(require('jsdom')))"
node -e "console.log(Object.keys(require('@mozilla/readability')))"
```
Expected: first prints an array including `JSDOM`; second prints an array including `Readability`.

- [x] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add jsdom and @mozilla/readability for article extraction

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M24xicaU6quWimYoqWPhGn"
```

---

### Task 2: Result types, URL validation, domain helper, and CLI harness scaffold

**Files:**
- Create: `src/lib/extractArticle.functions.ts`
- Create: `scripts/test-extract.ts`
- Modify: `package.json` (add `extract:test` script)

**Interfaces:**
- Consumes: `zod` (`z.string()`, `.safeParse`)
- Produces:
  - `export interface ExtractLink { href: string; text: string; isExternal: boolean }`
  - `export interface ExtractOk { ok: true; url: string; domain: string; title: string; author: string | null; publishedAt: string | null; excerpt: string; textLength: number; links: ExtractLink[] }`
  - `export interface ExtractError { ok: false; url: string; domain: string; error: "fetch_failed" | "not_html" | "no_article_content" }`
  - `export type ExtractResult = ExtractOk | ExtractError`
  - `export const extractUrlSchema: z.ZodString` (validates http/https URLs)
  - `function domainFromUrl(url: string): string` (internal, not exported)

- [x] **Step 1: Create `src/lib/extractArticle.functions.ts` with types, schema, and domain helper**

```ts
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
```

- [x] **Step 2: Create `scripts/test-extract.ts` harness scaffold**

```ts
import { extractUrlSchema } from "../src/lib/extractArticle.functions";

const url = process.argv[2];

if (!url) {
	console.error("Usage: tsx scripts/test-extract.ts <url>");
	process.exit(1);
}

const parsed = extractUrlSchema.safeParse(url);
if (!parsed.success) {
	console.error("Invalid URL:", parsed.error.issues[0]?.message);
	process.exit(1);
}

console.log("URL is valid:", parsed.data);
```

- [x] **Step 3: Add npm script**

In `package.json` `scripts`, add:
```json
"extract:test": "tsx scripts/test-extract.ts"
```

- [x] **Step 4: Run the harness to verify validation works**

Run:
```bash
pnpm extract:test "https://example.com/article"
pnpm extract:test "not-a-url"
pnpm extract:test "ftp://example.com/file"
```
Expected: first prints `URL is valid: https://example.com/article`; second and third print `Invalid URL: ...` and exit with a non-zero code.

- [x] **Step 5: Commit**

```bash
git add src/lib/extractArticle.functions.ts scripts/test-extract.ts package.json
git commit -m "feat: add extraction result types, URL validation, and CLI harness scaffold

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M24xicaU6quWimYoqWPhGn"
```

---

### Task 3: HTTP fetch with timeout and content-type check

**Files:**
- Modify: `src/lib/extractArticle.functions.ts`
- Modify: `scripts/test-extract.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `async function fetchHtml(url: string): Promise<{ ok: true; html: string; finalUrl: string } | { ok: false; error: "fetch_failed" | "not_html" }>` (internal, not exported)

- [x] **Step 1: Add `fetchHtml` to `src/lib/extractArticle.functions.ts`**

Append after `domainFromUrl`:

```ts
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
```

- [x] **Step 2: Extend the harness to exercise `fetchHtml`**

Replace the body of `scripts/test-extract.ts` (everything after the valid-URL check) so the full file reads:

```ts
import {
	extractUrlSchema,
	__internal,
} from "../src/lib/extractArticle.functions";

const url = process.argv[2];

if (!url) {
	console.error("Usage: tsx scripts/test-extract.ts <url>");
	process.exit(1);
}

const parsed = extractUrlSchema.safeParse(url);
if (!parsed.success) {
	console.error("Invalid URL:", parsed.error.issues[0]?.message);
	process.exit(1);
}

const fetched = await __internal.fetchHtml(parsed.data);
if (!fetched.ok) {
	console.error("Fetch failed:", fetched.error);
	process.exit(1);
}

console.log("Fetched", fetched.html.length, "bytes from", fetched.finalUrl);
```

This introduces an `__internal` export bundle so the harness can reach not-yet-public helpers without polluting the module's real API. Add it at the bottom of `src/lib/extractArticle.functions.ts`:

```ts
export const __internal = { fetchHtml };
```

(Later tasks add more functions to this object; the final task removes it once `extractArticleImpl` is assembled and the harness calls that instead.)

- [x] **Step 3: Run the harness against a real URL, a bad host, and a non-HTML URL**

Run:
```bash
pnpm extract:test "https://example.com/"
pnpm extract:test "https://this-domain-does-not-exist-xyz123.example/"
pnpm extract:test "https://httpbin.org/json"
```
Expected: first prints `Fetched N bytes from https://example.com/`; second prints `Fetch failed: fetch_failed`; third prints `Fetch failed: not_html`.

- [x] **Step 4: Commit**

```bash
git add src/lib/extractArticle.functions.ts scripts/test-extract.ts
git commit -m "feat: add fetchHtml with timeout, UA header, and content-type check

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M24xicaU6quWimYoqWPhGn"
```

---

### Task 4: jsdom document construction and meta-tag fallback extraction

**Files:**
- Modify: `src/lib/extractArticle.functions.ts`
- Modify: `scripts/test-extract.ts`

**Interfaces:**
- Consumes: `FetchHtmlOk.html`, `FetchHtmlOk.finalUrl` from Task 3
- Produces:
  - `function buildDocument(html: string, url: string): Document` (internal)
  - `interface MetaFallback { title: string | null; author: string | null; publishedAt: string | null }` (internal)
  - `function extractMetaFallback(document: Document): MetaFallback` (internal)

- [x] **Step 1: Add jsdom import and the two functions**

At the top of `src/lib/extractArticle.functions.ts`, add:

```ts
import { JSDOM } from "jsdom";
```

Append after `fetchHtml`:

```ts
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
```

Update the `__internal` export at the bottom:

```ts
export const __internal = { fetchHtml, buildDocument, extractMetaFallback };
```

- [x] **Step 2: Extend the harness to print meta fallback values**

Replace the harness body after the fetch check with:

```ts
const document = __internal.buildDocument(fetched.html, fetched.finalUrl);
const meta = __internal.extractMetaFallback(document);

console.log("Fetched", fetched.html.length, "bytes from", fetched.finalUrl);
console.log("Meta fallback:", meta);
```

- [x] **Step 3: Run against a real article page**

Run:
```bash
pnpm extract:test "https://en.wikipedia.org/wiki/Provenance"
```
Expected: prints the byte count, then a `Meta fallback:` line with a non-null `title` (from `og:title` or `<title>`).

- [x] **Step 4: Commit**

```bash
git add src/lib/extractArticle.functions.ts scripts/test-extract.ts
git commit -m "feat: add jsdom document construction and meta-tag fallback extraction

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M24xicaU6quWimYoqWPhGn"
```

---

### Task 5: Readability article parsing

**Files:**
- Modify: `src/lib/extractArticle.functions.ts`
- Modify: `scripts/test-extract.ts`

**Interfaces:**
- Consumes: `Document` from `buildDocument`, `MetaFallback` from `extractMetaFallback` (Task 4)
- Produces:
  - `interface ParsedArticle { title: string; author: string | null; publishedAt: string | null; contentHtml: string; textContent: string }` (internal)
  - `function parseReadableArticle(document: Document, meta: MetaFallback): ParsedArticle | null` (internal) — `null` signals `no_article_content`

- [x] **Step 1: Add Readability import and `parseReadableArticle`**

At the top, add:

```ts
import { Readability } from "@mozilla/readability";
```

Append after `extractMetaFallback`:

```ts
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

	if (!article || !article.textContent || article.textContent.trim().length === 0) {
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
```

Update `__internal`:

```ts
export const __internal = {
	fetchHtml,
	buildDocument,
	extractMetaFallback,
	parseReadableArticle,
};
```

- [x] **Step 2: Extend the harness**

Replace the harness body after computing `meta` with:

```ts
const article = __internal.parseReadableArticle(document, meta);

if (!article) {
	console.error("No article content extracted");
	process.exit(1);
}

console.log("Title:", article.title);
console.log("Author:", article.author);
console.log("Published:", article.publishedAt);
console.log("Text length:", article.textContent.length);
```

- [x] **Step 3: Run against a real article and a content-free page**

Run:
```bash
pnpm extract:test "https://en.wikipedia.org/wiki/Provenance"
pnpm extract:test "https://example.com/"
```
Expected: first prints a non-empty title, author (may be `null`), and a text length > 0; second prints `No article content extracted` and exits non-zero (example.com's placeholder page has no article body).

- [x] **Step 4: Commit**

```bash
git add src/lib/extractArticle.functions.ts scripts/test-extract.ts
git commit -m "feat: add Readability article parsing with meta-fallback merge

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M24xicaU6quWimYoqWPhGn"
```

---

### Task 6: Outbound link extraction

**Files:**
- Modify: `src/lib/extractArticle.functions.ts`
- Modify: `scripts/test-extract.ts`

**Interfaces:**
- Consumes: `ParsedArticle.contentHtml` (Task 5), `domainFromUrl` (Task 2), `ExtractLink` type (Task 2)
- Produces: `function extractLinks(contentHtml: string, baseUrl: string, domain: string): ExtractLink[]` (internal)

- [x] **Step 1: Add `extractLinks`**

Append after `parseReadableArticle`:

```ts
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
		});
	}

	return links;
}
```

Update `__internal`:

```ts
export const __internal = {
	fetchHtml,
	buildDocument,
	extractMetaFallback,
	parseReadableArticle,
	extractLinks,
};
```

- [x] **Step 2: Extend the harness**

Replace the `console.log("Text length:", ...)` line with:

```ts
console.log("Text length:", article.textContent.length);

const domain = new URL(fetched.finalUrl).hostname.replace(/^www\./, "");
const links = __internal.extractLinks(article.contentHtml, fetched.finalUrl, domain);
console.log("Links found:", links.length);
for (const link of links.slice(0, 10)) {
	console.log(" -", link.isExternal ? "[external]" : "[internal]", link.href);
}
```

- [x] **Step 3: Run against a real article with in-body links**

Run:
```bash
pnpm extract:test "https://en.wikipedia.org/wiki/Provenance"
```
Expected: prints `Links found: N` with `N > 0`, followed by up to 10 lines each tagged `[internal]` or `[external]`; no duplicate `href` values among them.

- [x] **Step 4: Commit**

```bash
git add src/lib/extractArticle.functions.ts scripts/test-extract.ts
git commit -m "feat: add outbound link extraction from article content

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M24xicaU6quWimYoqWPhGn"
```

---

### Task 7: Assemble `extractArticleImpl` and the `extractArticle` server function

**Files:**
- Modify: `src/lib/extractArticle.functions.ts`
- Modify: `scripts/test-extract.ts`

**Interfaces:**
- Consumes: every internal function from Tasks 2–6 (`domainFromUrl`, `fetchHtml`, `buildDocument`, `extractMetaFallback`, `parseReadableArticle`, `extractLinks`), `ExtractResult` type (Task 2)
- Produces:
  - `export async function extractArticleImpl(rawUrl: string): Promise<ExtractResult>`
  - `export const extractArticle` — a TanStack Start `createServerFn` wrapping `extractArticleImpl`

- [x] **Step 1: Add the import and both exports**

At the top, add:

```ts
import { createServerFn } from "@tanstack/react-start";
```

Append after `extractLinks`, replacing the `__internal` export block entirely:

```ts
export async function extractArticleImpl(rawUrl: string): Promise<ExtractResult> {
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

	return {
		ok: true,
		url,
		domain,
		title: article.title,
		author: article.author,
		publishedAt: article.publishedAt,
		excerpt: article.textContent.slice(0, 500),
		textLength: article.textContent.length,
		links,
	};
}

export const extractArticle = createServerFn({ method: "GET" })
	.validator((data: unknown) => extractUrlSchema.parse(data))
	.handler(async ({ data }) => extractArticleImpl(data));
```

This removes the `__internal` export — everything the harness needs is now reachable through `extractArticleImpl`.

- [x] **Step 2: Rewrite the harness to call `extractArticleImpl` directly**

Replace the entire contents of `scripts/test-extract.ts` with:

```ts
import { extractArticleImpl } from "../src/lib/extractArticle.functions";

const url = process.argv[2];

if (!url) {
	console.error("Usage: tsx scripts/test-extract.ts <url>");
	process.exit(1);
}

extractArticleImpl(url)
	.then((result) => {
		console.log(JSON.stringify(result, null, 2));
	})
	.catch((error) => {
		console.error("Unexpected error:", error);
		process.exit(1);
	});
```

- [x] **Step 3: Run against a real article end to end**

Run:
```bash
pnpm extract:test "https://en.wikipedia.org/wiki/Provenance"
```
Expected: prints a JSON object with `"ok": true`, non-empty `title`, `excerpt`, `textLength > 0`, and a `links` array.

- [x] **Step 4: Typecheck the project**

Run:
```bash
pnpm typecheck
```
Expected: no errors in `src/lib/extractArticle.functions.ts` or `scripts/test-extract.ts`.

- [x] **Step 5: Commit**

```bash
git add src/lib/extractArticle.functions.ts scripts/test-extract.ts
git commit -m "feat: assemble extractArticleImpl and extractArticle server function

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M24xicaU6quWimYoqWPhGn"
```

---

### Task 8: Final verification pass and README note

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: `extractArticleImpl` (Task 7), via `scripts/test-extract.ts`
- Produces: nothing new — documentation only

- [x] **Step 1: Run the harness against three real, varied URLs**

Run each and inspect the printed JSON:
```bash
pnpm extract:test "https://en.wikipedia.org/wiki/Citation"
pnpm extract:test "https://httpbin.org/json"
pnpm extract:test "https://this-domain-does-not-exist-xyz123.example/"
```
Expected:
- First: `"ok": true` with real title/excerpt/links.
- Second: `"ok": false, "error": "not_html"`.
- Third: `"ok": false, "error": "fetch_failed"`.

If a JS-heavy or paywalled site is available to try, run it too and confirm it resolves to `"ok": false, "error": "no_article_content"` (or `"fetch_failed"` if the site blocks the request outright) rather than throwing.

- [x] **Step 2: Update README's "What's mocked vs. real" section**

In `README.md`, find the section starting with `## What's mocked vs. real` and add a paragraph after the existing one:

```markdown

`src/lib/extractArticle.functions.ts` is the first real piece: given a URL it
fetches the page and runs Readability/jsdom extraction (title, author, date,
excerpt, outbound links). It's not wired into `/trace` yet — `traceData.ts`
still drives the UI — verify it standalone with
`pnpm extract:test <url>`.
```

- [x] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: note the real extraction pipeline alongside the mock

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M24xicaU6quWimYoqWPhGn"
```

---

## Done

At the end of Task 8: `pnpm extract:test <any URL>` returns a real, typed
`ExtractResult` — clean article text, metadata, and outbound links for
extractable pages, and a typed error for pages that fail to fetch, aren't
HTML, or yield no article content. Nothing outside `src/lib/extractArticle.functions.ts`,
`scripts/test-extract.ts`, `package.json`, and `README.md` was touched.
Phase 2 (storage schema) starts from this module's `ExtractResult` shape.
