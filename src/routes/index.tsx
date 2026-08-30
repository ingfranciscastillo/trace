import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
		confidence: 74,
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
	{ id: "d-e5", from: "d-source", to: "d-original", kind: "derived_from" },
];

function LandingPage() {
	const navigate = useNavigate();
	const [url, setUrl] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [transform] = useState<GraphTransform>({ x: 30, y: 20, scale: 0.92 });

	function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!url.trim() || submitting) return;
		setSubmitting(true);
		navigate({ to: "/trace", search: { url: url.trim() } });
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
					{submitting ? "TRACING…" : "TRACE"}
				</button>
			</form>

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
		</div>
	);
}
