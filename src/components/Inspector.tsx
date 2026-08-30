import type { TraceEdge, TraceNode, TraceResult } from "../lib/traceData";

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

function getStats(
	node: TraceNode,
	trace: TraceResult,
	edges: TraceEdge[],
): Stat[] {
	const citedBy = edges.filter(
		(e) => e.to === node.id && e.kind === "copied_from",
	).length;

	switch (node.type) {
		case "ARTICLE":
			return [
				{ label: "SOURCES", value: trace.stats.sources },
				{ label: "CLAIMS", value: trace.stats.claims },
				{ label: "UNVERIFIED", value: trace.stats.unverified },
				{ label: "FIRST SEEN", value: trace.stats.firstSeen },
			];
		case "CLAIM":
			return [
				{
					label: "CONFIDENCE",
					value: node.confidence ? `${node.confidence}%` : "—",
					accent: !node.unverified,
				},
				{
					label: "COPIED BY",
					value: `${citedBy || node.copiedBy || 0} domains`,
				},
				{ label: "FIRST SEEN", value: trace.stats.firstSeen },
			];
		case "SOURCE":
		case "DATA":
			return [
				{ label: "CITED BY", value: `${node.copiedBy ?? citedBy} articles` },
				{ label: "FIRST SEEN", value: trace.stats.firstSeen },
			];
		case "ORIGINAL":
			return [
				{
					label: "FIRST SEEN",
					value: node.date ?? trace.stats.firstSeen,
					accent: true,
				},
				{ label: "REFERENCED BY", value: trace.timeline.length - 1 },
			];
		default:
			return [];
	}
}

export function Inspector({
	node,
	trace,
}: {
	node: TraceNode | null;
	trace: TraceResult;
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

	return (
		<div className="inspector">
			<div>
				<div className="inspector__type">{node.type}</div>
				<h3 className="inspector__title">{node.title}</h3>
				<div className="inspector__meta">
					{node.domain}
					{node.date ? ` · ${node.date}` : ""}
				</div>
				{node.unverified && (
					<p className="inspector__excerpt">
						This claim does not link to any verifiable source. Trace found no
						public origin for it.
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
			</div>
		</div>
	);
}
