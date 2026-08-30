import { queryOptions } from "@tanstack/react-query";

export type NodeType =
	| "ARTICLE"
	| "AUTHOR"
	| "CLAIM"
	| "SOURCE"
	| "DATA"
	| "ORIGINAL";
export type EdgeKind =
	| "cites"
	| "authored_by"
	| "copied_from"
	| "derived_from"
	| "published_by"
	| "first_seen_at";

export interface TraceNode {
	id: string;
	type: NodeType;
	title: string;
	domain?: string;
	date?: string;
	excerpt?: string;
	confidence?: number;
	copiedBy?: number;
	unverified?: boolean;
	firstSeen?: boolean;
	x: number;
	y: number;
}

export interface TraceEdge {
	id: string;
	from: string;
	to: string;
	kind: EdgeKind;
}

export interface TimelineEntry {
	date: string;
	label: string;
	domain: string;
}

export interface TraceResult {
	id: string;
	url: string;
	domain: string;
	title: string;
	author: string;
	publishedAt: string;
	stats: {
		sources: number;
		claims: number;
		unverified: number;
		firstSeen: string;
	};
	nodes: TraceNode[];
	edges: TraceEdge[];
	timeline: TimelineEntry[];
}

function domainFromUrl(raw: string): string {
	try {
		return new URL(raw).hostname.replace(/^www\./, "");
	} catch {
		return raw.replace(/^https?:\/\//, "").split("/")[0] || "unknown.source";
	}
}

/**
 * There is no real crawler behind this prototype — build() always returns the
 * same demonstration graph, seeded with the domain the user actually typed,
 * so the UI can be evaluated against realistic data shapes.
 */
function build(url: string): TraceResult {
	const domain = domainFromUrl(url || "https://example.com/article");

	const nodes: TraceNode[] = [
		{
			id: "article",
			type: "ARTICLE",
			title: "How AI Is Reshaping the College Classroom",
			domain,
			date: "2024-03-12",
			x: 620,
			y: 20,
		},
		{
			id: "author",
			type: "AUTHOR",
			title: "J. Herrera",
			domain: "staff writer, 34 traced articles",
			x: 900,
			y: 150,
		},
		{
			id: "claim1",
			type: "CLAIM",
			title: "40% of universities already use generative AI tools",
			domain: "excerpt · paragraph 2",
			confidence: 82,
			x: 380,
			y: 150,
		},
		{
			id: "claim2",
			type: "CLAIM",
			title: "62% of teachers already use AI in class",
			domain: "excerpt · paragraph 4",
			unverified: true,
			x: 700,
			y: 300,
		},
		{
			id: "sourceA",
			type: "SOURCE",
			title: "AI adoption in higher education",
			domain: "revista-edu.org",
			date: "2024-02-03",
			x: 160,
			y: 300,
		},
		{
			id: "data",
			type: "DATA",
			title: "Higher-ed AI adoption dataset (2023)",
			domain: "data.education.gov",
			copiedBy: 6,
			x: 160,
			y: 450,
		},
		{
			id: "original",
			type: "ORIGINAL",
			title: "National Teacher Survey 2023",
			domain: "gov.example · PDF",
			date: "2023-06-04",
			firstSeen: true,
			x: 160,
			y: 600,
		},
		{
			id: "copy1",
			type: "ARTICLE",
			title: '"AI use among teachers accelerates"',
			domain: "techdaily.example",
			date: "2024-03-14",
			x: 500,
			y: 460,
		},
		{
			id: "copy2",
			type: "ARTICLE",
			title: '"Universities embrace generative AI"',
			domain: "eduweekly.example",
			date: "2024-03-15",
			x: 700,
			y: 460,
		},
		{
			id: "copy3",
			type: "ARTICLE",
			title: '"The AI classroom is already here"',
			domain: "blogai.example",
			date: "2024-03-18",
			x: 900,
			y: 460,
		},
	];

	const edges: TraceEdge[] = [
		{ id: "e1", from: "article", to: "author", kind: "authored_by" },
		{ id: "e2", from: "article", to: "claim1", kind: "cites" },
		{ id: "e3", from: "article", to: "claim2", kind: "cites" },
		{ id: "e4", from: "claim1", to: "sourceA", kind: "cites" },
		{ id: "e5", from: "sourceA", to: "data", kind: "derived_from" },
		{ id: "e6", from: "data", to: "original", kind: "derived_from" },
		{ id: "e7", from: "copy1", to: "claim1", kind: "copied_from" },
		{ id: "e8", from: "copy2", to: "claim1", kind: "copied_from" },
		{ id: "e9", from: "copy3", to: "claim1", kind: "copied_from" },
	];

	const timeline: TimelineEntry[] = [
		{
			date: "2023-06-04",
			label: "Original survey published",
			domain: "gov.example",
		},
		{
			date: "2024-02-03",
			label: "Cited in a secondary study",
			domain: "revista-edu.org",
		},
		{ date: "2024-03-12", label: "Referenced in this article", domain },
		{ date: "2024-03-14", label: "Republished", domain: "techdaily.example" },
		{ date: "2024-03-15", label: "Republished", domain: "eduweekly.example" },
		{ date: "2024-03-18", label: "Republished", domain: "blogai.example" },
	];

	const sources =
		nodes.filter(
			(n) => n.type !== "ARTICLE" && n.type !== "AUTHOR" && n.type !== "CLAIM",
		).length + nodes.filter((n) => n.id.startsWith("copy")).length;
	const claims = nodes.filter((n) => n.type === "CLAIM").length;
	const unverified = nodes.filter((n) => n.unverified).length;

	return {
		id: url || domain,
		url: url || `https://${domain}/article`,
		domain,
		title: "How AI Is Reshaping the College Classroom",
		author: "J. Herrera",
		publishedAt: "2024-03-12",
		stats: { sources, claims, unverified, firstSeen: "2023-06-04" },
		nodes,
		edges,
		timeline,
	};
}

async function fetchTrace(url: string): Promise<TraceResult> {
	// Simulated network + analysis latency.
	await new Promise((resolve) => setTimeout(resolve, 700));
	return build(url);
}

export function traceQueryOptions(url: string) {
	return queryOptions({
		queryKey: ["trace", url],
		queryFn: () => fetchTrace(url),
	});
}
