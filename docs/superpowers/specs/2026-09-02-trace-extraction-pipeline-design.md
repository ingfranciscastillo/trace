# Trace — Extraction Pipeline (Phase 1 of 5)

## Context

Trace is a provenance-investigation tool. The UI (`/trace?url=...`, `GraphCanvas`,
`Inspector`) is fully built but runs entirely on a hardcoded mock graph
(`src/lib/traceData.ts`). There is no real crawler, no NLP/extraction, and no
domain tables in the database (`src/db/schema.ts` only has `todos`).

The end goal is a system that, given a URL, can detect:

1. Information without a source
2. Repeated/reused sources across articles
3. Content copied between different sites
4. Multiple articles depending on the same source
5. When a claim first appeared
6. Possible citation chains
7. Divergence between a claim and its original source

This is too large for one design/plan cycle. It decomposes into five
sequential sub-projects:

1. **Fetch + extraction pipeline** (this document)
2. Storage/graph schema (Drizzle: articles, claims, sources, edges)
3. Copy/dedup detection across stored articles
4. Citation chain construction + first-seen timeline
5. Claim-vs-source divergence detection

Phases 2–5 are out of scope here and undesigned; each gets its own
brainstorming pass when its turn comes.

## Goal of this phase

Given a URL, fetch the page and extract clean article text, metadata, and
outbound links — the raw material every later phase (storage, dedup, citation
chains, divergence) will consume. No claim extraction yet (heuristic claim
detection is deliberately deferred to a later phase so this pipeline stays
focused on getting clean text + links right first). No DB writes. No UI
wiring — `/trace` keeps using the mock (`traceData.ts`) until the graph
(phase 2+) exists to back it; wiring a single real node into the UI now would
leave the page half-broken (claims/sources empty) for no benefit.

## Non-goals

- Claim/statement extraction (phase 2+, separate heuristic/model work)
- JS-rendered / SPA pages — plain `fetch()` + static HTML parsing only, no
  headless browser. Sites that require JS execution will surface as
  `no_article_content` and can be revisited later if it matters in practice.
- Persistence — nothing is written to the database in this phase
- Any change to `/trace`, `traceData.ts`, or `src/db/schema.ts`

## Architecture

One new server-side module, no new routes, no new tables.

```
src/lib/extractArticle.functions.ts   -- the server function
scripts/test-extract.ts                -- manual verification script (tsx)
```

### `extractArticle`

A TanStack Start `createServerFn` (GET), following the project's existing
`.functions.ts` convention (see `src/lib/auth.functions.ts`).

**Input**: `url: string`, validated with `zod` — must parse as a URL with
`http:`/`https:` protocol. Invalid input throws (validation failure, not a
pipeline error).

**Output** (discriminated union):

```ts
type ExtractResult =
  | {
      ok: true;
      url: string;
      domain: string;
      title: string;
      author: string | null;
      publishedAt: string | null; // ISO date if found
      excerpt: string;            // first ~500 chars of plain article text
      textLength: number;
      links: { href: string; text: string; isExternal: boolean }[];
    }
  | {
      ok: false;
      url: string;
      domain: string;
      error: "fetch_failed" | "not_html" | "no_article_content";
    };
```

The `ok: false` branch is a first-class, expected outcome — not an
exception — because "this page yielded no extractable content" is itself
useful evidence for later phases (e.g. a claim whose source URL fails to
extract is a strong signal for "information without a source").

### Pipeline steps

1. **Validate** URL shape (zod) and derive `domain` (hostname, `www.`
   stripped) up front so it's available even in error branches.
2. **Fetch** with:
   - A realistic `User-Agent` header (many sites block default fetch UAs)
   - A timeout (~10s) via `AbortSignal.timeout`
   - Any network error or non-2xx status → `{ ok: false, error: "fetch_failed" }`
3. **Content-type check**: response must be `text/html`-ish → otherwise
   `{ ok: false, error: "not_html" }`.
4. **Parse**: build a `jsdom` `JSDOM` document from the response body.
5. **Extract**: run `@mozilla/readability`'s `Readability` against the jsdom
   document.
   - No result / empty `textContent` → `{ ok: false, error: "no_article_content" }`
6. **Metadata**, preferring Readability's fields and falling back to meta
   tags when Readability doesn't supply them:
   - `title`: Readability title → `og:title` → `<title>`
   - `author`: Readability byline → `meta[name=author]`
   - `publishedAt`: `meta[property=article:published_time]` →
     `<time datetime>` in the parsed content, else `null`
7. **Links**: collect `<a href>` only from Readability's cleaned
   `content` (the article body), not the original document — this
   excludes nav/footer/sidebar boilerplate. For each: resolve relative
   → absolute against the final response URL (post-redirect), dedupe by
   resolved href, mark `isExternal` (hostname differs from `domain`).
8. **Excerpt/length**: plain-text `textContent`, trimmed; `excerpt` is the
   first ~500 characters, `textLength` is the full length.

### Error handling

No step throws for expected failure modes (network errors, wrong content
type, unparseable article). All are caught and mapped to the `ok: false`
variants above. Only genuinely unexpected exceptions propagate.

### Dependencies added

- `jsdom` — DOM implementation Readability requires to walk/mutate the
  document
- `@mozilla/readability` — article extraction, paired with jsdom (its
  standard, documented pairing)

### Testing

No test framework is currently installed (no vitest in `devDependencies`).
Given YAGNI, this phase doesn't introduce one for a single function. Instead:
`scripts/test-extract.ts`, run via the existing `tsx` devDependency, takes a
URL argument, calls `extractArticle` directly (not through HTTP), and prints
the result — enough to manually verify against a handful of real, varied
URLs (a clean article site, a site with a paywall/JS wall to confirm graceful
`no_article_content`, a non-HTML URL to confirm `not_html`).

## Future phases (not designed here)

Phase 2 (storage schema) will define how `ExtractResult` gets persisted and
is where `ARTICLE`/`SOURCE`/`DATA`/`ORIGINAL` nodes and `cites`/`derived_from`
edges (already modeled in `traceData.ts`'s types) get real rows. Phases 3–5
build on that stored corpus. Each is brainstormed separately when reached.
