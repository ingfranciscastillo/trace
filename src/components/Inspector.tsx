import { Link } from "@tanstack/react-router";
import type { TraceEdge, TraceGraph, TraceNode } from "../lib/traceGraph";

interface Stat {
	label: string;
	value: string | number;
	accent?: boolean;
}

function buildChain(
	nodeId: string,
	edges: TraceEdge[],
	nodes: TraceNode[],
): string[] {
	const byId = new Map(nodes.map((n) => [n.id, n]));
	const chain: string[] = [];
	let current = nodeId;
	let hops = 0;
	while (hops < 6) {
		const next = edges.find(
			(e) =>
				e.from === current &&
				e.kind !== "copied_from" &&
				e.kind !== "authored_by",
		);
		if (!next) break;
		const target = byId.get(next.to);
		if (!target) break;
		chain.push(target.title);
		current = next.to;
		hops += 1;
	}
	return chain;
}

function confidenceLabel(node: TraceNode): string {
	if (!node.confidenceLevel) return "—";
	const reasons = node.uncertaintyReasons?.length
		? ` (${node.uncertaintyReasons.join(", ")})`
		: "";
	return `${node.confidenceLevel.toUpperCase()}${reasons}`;
}

function getStats(
	node: TraceNode,
	trace: TraceGraph,
	edges: TraceEdge[],
): Stat[] {
	const connections = edges.filter(
		(e) => e.from === node.id || e.to === node.id,
	).length;
	const citedBy = edges.filter(
		(e) => e.to === node.id && e.kind === "copied_from",
	).length;

	const base: Stat[] = [{ label: "CONNECTIONS", value: connections }];
	if (node.divergenceStatus) {
		base.push({
			label: "VS. CLAIM",
			value: node.divergenceStatus.toUpperCase().replace("_", " "),
			accent: node.divergenceStatus === "number_mismatch" || node.divergenceStatus === "unsupported",
		});
	}

	switch (node.type) {
		case "ARTICLE":
			return [
				{ label: "SOURCES", value: trace.stats.sources },
				{ label: "CLAIMS", value: trace.stats.claims },
				{ label: "UNVERIFIED", value: trace.stats.unverified },
				{ label: "FIRST SEEN", value: trace.stats.firstSeen },
				...base,
			];
		case "CLAIM":
			return [
				{
					label: "CONFIDENCE",
					value: confidenceLabel(node),
					accent: node.confidenceLevel !== "unverified",
				},
				{ label: "COPIED BY", value: `${citedBy || node.copiedBy || 0} domains` },
				...base,
			];
		case "SOURCE":
			return [
				{ label: "CITED BY", value: `${node.copiedBy ?? citedBy} articles` },
				...base,
			];
		case "ORIGINAL":
			return [
				{ label: "FIRST SEEN", value: node.date ?? trace.stats.firstSeen, accent: true },
				...base,
			];
		default:
			return base;
	}
}

const FIND_SOURCES_ERRORS: Record<string, string> = {
	missing_api_key: "Brave Search API key is not configured.",
	unauthorized: "Brave Search rejected the API key.",
	rate_limited: "Brave Search rate limit hit — try again shortly.",
	request_failed: "Brave Search request failed.",
};

type FindSourcesResult =
	| { ok: true; count: number }
	| { ok: false; error: string };

export function Inspector({
	node,
	trace,
	onFindSources,
	onResolveSource,
	findSourcesPending,
	resolveSourcePending,
	findSourcesResult,
}: {
	node: TraceNode | null;
	trace: TraceGraph;
	onFindSources?: (claimId: number) => void;
	onResolveSource?: (claimSourceId: number) => void;
	findSourcesPending?: boolean;
	resolveSourcePending?: boolean;
	findSourcesResult?: FindSourcesResult;
}) {
	if (!node) {
		return (
			<div className="inspector">
				<p className="inspector__empty">
					Select a node to inspect its evidence.
				</p>
			</div>
		);
	}

	const stats = getStats(node, trace, trace.edges);
	const chain = buildChain(node.id, trace.edges, trace.nodes);
	const rootNodeId = `article-${trace.id}`;
	const canOpenOwnTrace =
		node.url &&
		node.id !== rootNodeId &&
		(node.type === "ARTICLE" || node.type === "SOURCE");

	return (
		<div className="inspector">
			<div>
				<div className="inspector__type">{node.type}</div>
				<h3 className="inspector__title">
					{node.title}
					{node.url && (
						<a
							className="inspector__external-link"
							href={node.url}
							target="_blank"
							rel="noopener noreferrer"
							title="Open original page"
							onClick={(e) => e.stopPropagation()}
						>
							↗
						</a>
					)}
				</h3>
				<div className="inspector__meta">
					{node.domain}
					{node.date ? ` · ${node.date}` : ""}
				</div>
				{node.excerpt && node.excerpt !== node.title && (
					<p className="inspector__excerpt">{node.excerpt}</p>
				)}
				{node.unverified && (
					<p className="inspector__excerpt">
						This claim has no attached citation, no attribution, and no
						corroborating occurrence elsewhere in the corpus — información sin
						fuente.
					</p>
				)}
			</div>

			<div className="inspector__stats">
				{stats.map((s) => (
					<div key={s.label}>
						<div className="inspector__stat-label">{s.label}</div>
						<div
							className={
								"inspector__stat-value" +
								(s.accent ? " inspector__stat-value--accent" : "")
							}
						>
							{s.value}
						</div>
					</div>
				))}
			</div>

			<div>
				<div className="inspector__trace-label">TRACE</div>
				{chain.length > 0 ? (
					<ul className="trace-chain">
						{chain.map((title) => (
							<li key={title}>{title}</li>
						))}
					</ul>
				) : (
					<p className="inspector__excerpt">
						No further sources found beyond this point.
					</p>
				)}

				{node.type === "CLAIM" && node.claimId && !node.hasSources && (
					<div className="inspector__actions">
						<button
							type="button"
							className="btn"
							disabled={findSourcesPending}
							onClick={() => onFindSources?.(node.claimId!)}
						>
							{findSourcesPending ? "SEARCHING…" : "FIND SOURCES (1 API call)"}
						</button>
						{findSourcesResult && !findSourcesResult.ok && (
							<p className="inspector__excerpt inspector__excerpt--error">
								{FIND_SOURCES_ERRORS[findSourcesResult.error] ?? findSourcesResult.error}
							</p>
						)}
						{findSourcesResult?.ok && findSourcesResult.count === 0 && (
							<p className="inspector__excerpt">
								No search results found for this claim.
							</p>
						)}
					</div>
				)}

				{node.type === "SOURCE" && node.claimSourceId && (
					<div className="inspector__actions">
						<button
							type="button"
							className="btn"
							disabled={resolveSourcePending}
							onClick={() => onResolveSource?.(node.claimSourceId!)}
						>
							{resolveSourcePending ? "FETCHING…" : "RESOLVE THIS SOURCE"}
						</button>
					</div>
				)}

				{canOpenOwnTrace && (
					<div className="inspector__actions">
						<Link
							to="/trace"
							search={{ url: node.url!, firecrawl: false }}
							className="btn"
						>
							REVIEW THIS ARTICLE
						</Link>
					</div>
				)}
			</div>
		</div>
	);
}
