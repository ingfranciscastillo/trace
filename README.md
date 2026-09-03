<div align="center">
  <img src="public/logo-square-dark-bg.svg" alt="Trace" width="100">

# Trace

*Follow information back to where it began.*

<p align="center">English · <a href="README.es.md">Español</a></p>

</div>

## What is Trace?

Trace is a provenance-tracing tool. Paste a URL and it reconstructs where an
article's claims actually come from: what it cites, what cites it back,
what's a near-verbatim copy elsewhere, and — when the corpus already has
enough to tell — the earliest occurrence of each claim.

Nothing here is invented. Every confidence level, timeline date, and
"unverified" flag is derived from evidence already on the page or already in
the corpus — Trace never fabricates certainty it doesn't have.

## Features

- **Article extraction** — title, author, date, full text, and outbound
  links pulled from any URL via Readability, with SSRF protections against
  internal and private targets.
- **Claim detection** — statistics, attributions, and cited facts are pulled
  out sentence by sentence and tied to their paragraph.
- **Citation & copy graph** — resolves `cites` and `copied_from`
  relationships across every article in the corpus, including which side is
  chronologically earlier when dates allow it.
- **First-seen tracking** — finds the earliest dated occurrence of a claim
  across the corpus, explicit about the difference between "earliest found"
  and "confirmed origin."
- **Confidence, never invented** — every claim and relationship gets an
  evidence-based level (high / medium / low / unverified) with the reason
  attached, never a made-up percentage.
- **Divergence detection** — compares a claim's wording against its resolved
  source's actual text to flag number mismatches or claims the source
  doesn't actually support.
- **On-demand source chasing** — Brave Search-backed source discovery and
  depth-limited chain following, triggered per claim, one request at a time.
- **Optional Firecrawl fallback** — for sources a plain fetch can't reach
  past bot protection, available once signed in.
- **Interactive provenance graph** — an auto-laid-out, pan-and-zoom graph of
  the whole trace, with an inspector panel and a timeline of every dated
  event found.
- **Per-account history** — signed-in users get a private, real trace
  history; anonymous visits are never recorded.
