# Trace

Provenance-investigation tool built with **TanStack Start**, **TanStack Router** and **TanStack Query**.

## Stack

- `@tanstack/react-start` — SSR framework / file-based routing
- `@tanstack/react-router` — routing, search-param validation (`zod`), loaders
- `@tanstack/react-query` — data fetching (`ensureQueryData` in the route loader + `useSuspenseQuery` in the component)
- Plain CSS design system (no UI kit) — tokens in `src/styles/app.css`
- Fonts: General Sans (display), DM Sans (body/UI), DM Mono (data/metadata)

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm run start   # production build
npm run typecheck
```

## Structure

```
src/
  router.tsx            router + QueryClient wiring
  routes/
    __root.tsx           html shell, fonts, QueryClientProvider
    index.tsx             landing page (hero + animated demo graph)
    trace.tsx              /trace?url=... — search validation, query loader, workspace
  components/
    Nav.tsx
    Inspector.tsx          "SELECTED ENTITY" bottom panel
    graph/GraphCanvas.tsx   pan / zoom / select SVG+HTML graph renderer
  lib/traceData.ts         types + mock provenance graph + query options
  styles/app.css           design tokens + all component styles
```

## What's mocked vs. real

There is no crawler behind this prototype. `src/lib/traceData.ts` always returns the
same demonstration graph (seeded with whatever domain you type), through a `queryFn`
with an artificial delay — this is where a real extraction/citation-graph service
would plug in, without touching the routing, query-caching or UI layers above it.

`src/lib/extractArticle.functions.ts` is the first real piece: given a URL it
fetches the page and runs Readability/jsdom extraction (title, author, date,
excerpt, outbound links). It's not wired into `/trace` yet — `traceData.ts`
still drives the UI — verify it standalone with
`pnpm extract:test <url>`.

## Notes on the graph

- Nodes are plain positioned buttons; edges are orthogonal SVG paths recomputed from
  each node's measured `offsetLeft/Top/Width/Height`, so text wrapping never breaks a
  connector.
- Pan (drag) and zoom (wheel) apply a single CSS transform to the shared viewport —
  cheap, and keeps edges perfectly attached at any zoom level.
- Selecting a node dims everything else and highlights only its direct connections —
  no node/edge color-codes "good" vs "bad" sources; status is communicated through
  typography and line style (dashed = unverified), keeping the accent color reserved
  for selection, active connections and "first seen" evidence, as specified.
