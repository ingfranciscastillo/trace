import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FirecrawlToggle } from "../components/FirecrawlToggle";
import {
	GraphCanvas,
	type GraphTransform,
} from "../components/graph/GraphCanvas";
import { Nav } from "../components/Nav";
import type { TraceEdge, TraceNode } from "../lib/traceData";

export const Route = createFileRoute("/")({
	component: LandingPage,
});

const DEMO_NODES: TraceNode[] = [
	{
		id: "d-article",
		type: "ARTICLE",
		title: "Any article, anywhere",
		x: 260,
		y: 0,
	},
	{
		id: "d-author",
		type: "AUTHOR",
		title: "Byline",
		domain: "attribution",
		x: 460,
		y: 120,
	},
	{
		id: "d-claim",
		type: "CLAIM",
		title: "The claim it makes",
		domain: "excerpt",
		confidenceLevel: "medium",
		x: 140,
		y: 120,
	},
	{
		id: "d-source",
		type: "SOURCE",
		title: "The source it cites",
		domain: "external domain",
		x: 40,
		y: 240,
	},
	{
		id: "d-copies",
		type: "SOURCE",
		title: "Republished elsewhere",
		copiedBy: 14,
		x: 280,
		y: 240,
	},
	{
		id: "d-original",
		type: "ORIGINAL",
		title: "Where it began",
		domain: "first appearance",
		firstSeen: true,
		x: 40,
		y: 360,
	},
];

const DEMO_EDGES: TraceEdge[] = [
	{ id: "d-e1", from: "d-article", to: "d-author", kind: "authored_by" },
	{ id: "d-e2", from: "d-article", to: "d-claim", kind: "cites" },
	{ id: "d-e3", from: "d-claim", to: "d-source", kind: "cites" },
	{ id: "d-e4", from: "d-claim", to: "d-copies", kind: "copied_from" },
	{ id: "d-e5", from: "d-source", to: "d-original", kind: "first_seen_at" },
];

function LandingPage() {
	const navigate = useNavigate();
	const [url, setUrl] = useState("");
	const [useFirecrawl, setUseFirecrawl] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [transform] = useState<GraphTransform>({ x: 30, y: 20, scale: 0.92 });

	// Rendered obfuscated (user "(at)" domain) so a scraper reading raw HTML
	// never sees a real address; swapped for a live mailto link once JS runs.
	const [emailRevealed, setEmailRevealed] = useState(false);
	useEffect(() => setEmailRevealed(true), []);
	const emailUser = "franciscastillodev";
	const emailDomain = "proton.me";

	function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!url.trim() || submitting) return;
		setSubmitting(true);
		navigate({
			to: "/trace",
			search: { url: url.trim(), firecrawl: useFirecrawl },
		});
	}

	return (
		<div className="landing">
			<Nav />

			<section className="hero">
				<div>
					<div className="hero__eyebrow">PROVENANCE ENGINE</div>
					<h1 className="hero__title">
						Follow information
						<br />
						back to where it began.
					</h1>
				</div>
				<div className="hero__meta">
					<div>
						TRACE ID <b>TR-8F21A</b>
					</div>
					<div>
						SOURCES <b>18</b>
					</div>
					<div>
						CLAIMS <b>42</b>
					</div>
					<div>
						UNVERIFIED <b>03</b>
					</div>
					<div>
						FIRST SEEN <b>2018-03-14</b>
					</div>
				</div>
			</section>

			<form className="trace-form" onSubmit={onSubmit}>
				<input
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					placeholder="paste a URL to trace…"
					autoComplete="off"
					spellCheck={false}
				/>
				<button type="submit" disabled={submitting}>
					{submitting && <span className="logo-spinner" />}
					{submitting ? "TRACING…" : "TRACE"}
				</button>
			</form>

			<FirecrawlToggle checked={useFirecrawl} onChange={setUseFirecrawl} />

			<div className="stat-row">
				<span>
					EXAMPLE <b>elmedio.example/aulas-ia</b>
				</span>
				<span>
					AVG. DEPTH <b>4 hops</b>
				</span>
				<span>
					COVERAGE <b>2.1M domains</b>
				</span>
			</div>

			<div className="features">
				<div className="feature">
					<div className="feature__label">CLAIM EXTRACTION</div>
					<p>
						Every checkable sentence, pulled out automatically — statistics,
						attributions, citations.
					</p>
				</div>
				<div className="feature">
					<div className="feature__label">SOURCE TRACING</div>
					<p>
						Follow a claim to its cited source, then to that source's sources,
						as far as the chain goes.
					</p>
				</div>
				<div className="feature">
					<div className="feature__label">COPY DETECTION</div>
					<p>
						See when text has been republished or copied elsewhere, and how many
						times.
					</p>
				</div>
				<div className="feature">
					<div className="feature__label">CONFIDENCE, EXPLAINED</div>
					<p>
						Every confidence level comes with the evidence behind it — never a
						made-up score.
					</p>
				</div>
			</div>

			<div className="demo-wrap">
				<div className="demo-wrap__label">EXAMPLE PROVENANCE GRAPH</div>
				<div className="demo-stage">
					<GraphCanvas
						nodes={DEMO_NODES}
						edges={DEMO_EDGES}
						interactive={false}
						animated
						transform={transform}
					/>
				</div>
			</div>

			<div className="contact-section">
				<div className="contact-section__eyebrow">CONTACT</div>
				<p>
					Questions, feedback, or something looks wrong — reach out directly at{" "}
					{emailRevealed ? (
						<a href={`mailto:${emailUser}@${emailDomain}`}>
							{emailUser}@{emailDomain}
						</a>
					) : (
						<span>
							{emailUser} (at) {emailDomain.replace(".", " (dot) ")}
						</span>
					)}
					.
				</p>
				<a
					className="contact-section__github"
					href="https://github.com/ingfranciscastillo"
					target="_blank"
					rel="noopener noreferrer"
					aria-label="GitHub"
				>
					<span className="sr-only">GitHub</span>
					<svg viewBox="0 0 1024 1024" fill="none" aria-hidden="true">
						<path
							fillRule="evenodd"
							clipRule="evenodd"
							d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z"
							transform="scale(64)"
							fill="currentColor"
						/>
					</svg>
				</a>
			</div>
		</div>
	);
}
