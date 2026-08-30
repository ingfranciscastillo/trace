import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import {
	clampScale,
	GraphCanvas,
	type GraphTransform,
} from "../components/graph/GraphCanvas";
import { Inspector } from "../components/Inspector";
import { Nav } from "../components/Nav";
import { traceQueryOptions } from "../lib/traceData";

const searchSchema = z.object({
	url: z.string().catch(""),
});

export const Route = createFileRoute("/trace")({
	validateSearch: (search) => searchSchema.parse(search),
	loaderDeps: ({ search }) => ({ url: search.url }),
	loader: ({ context: { queryClient }, deps: { url } }) =>
		queryClient.query(traceQueryOptions(url)),
	pendingComponent: TracePending,
	component: TraceWorkspace,
});

function TracePending() {
	return (
		<div className="workspace">
			<Nav />
			<div className="loading-state">
				<span className="loading-dot" />
				tracing sources…
			</div>
		</div>
	);
}

function TraceWorkspace() {
	const { url } = Route.useSearch();
	const { data: trace } = useSuspenseQuery(traceQueryOptions(url));
	const navigate = useNavigate();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [transform, setTransform] = useState<GraphTransform>({
		x: 70,
		y: 40,
		scale: 1,
	});

	const selectedNode = trace.nodes.find((n) => n.id === selectedId) ?? null;

	function resetView() {
		setTransform({ x: 70, y: 40, scale: 1 });
	}
	function zoom(delta: number) {
		setTransform((t) => ({ ...t, scale: clampScale(t.scale + delta) }));
	}

	return (
		<div className="workspace">
			<Nav />

			<header className="workspace__header">
				<div className="workspace__title">
					<h1>{trace.title}</h1>
					<span>
						{trace.domain} · {trace.publishedAt}
					</span>
				</div>
				<div className="workspace__toolbar">
					<span className="mono">{Math.round(transform.scale * 100)}%</span>
					<button
						type="button"
						className="btn"
						onClick={() => zoom(-0.15)}
						aria-label="Zoom out"
					>
						−
					</button>
					<button
						type="button"
						className="btn"
						onClick={() => zoom(0.15)}
						aria-label="Zoom in"
					>
						+
					</button>
					<button type="button" className="btn" onClick={resetView}>
						RESET VIEW
					</button>
					<button
						type="button"
						className="btn btn--accent"
						onClick={() => navigate({ to: "/" })}
					>
						NEW ANALYSIS
					</button>
				</div>
			</header>

			<div className="workspace__stage">
				<GraphCanvas
					nodes={trace.nodes}
					edges={trace.edges}
					selectedId={selectedId}
					onSelect={(id) =>
						setSelectedId((current) => (current === id ? null : id))
					}
					transform={transform}
					onTransformChange={setTransform}
				/>
			</div>

			<Inspector node={selectedNode} trace={trace} />
		</div>
	);
}
