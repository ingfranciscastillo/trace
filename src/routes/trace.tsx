import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { FirecrawlToggle } from "../components/FirecrawlToggle";
import {
	clampScale,
	GraphCanvas,
	type GraphTransform,
} from "../components/graph/GraphCanvas";
import { Inspector } from "../components/Inspector";
import { Nav } from "../components/Nav";
import { Timeline } from "../components/Timeline";
import { findSources, resolveSource } from "../lib/chain.functions";
import { traceQueryOptions } from "../lib/traceData";

const searchSchema = z.object({
	url: z.string().catch(""),
	firecrawl: z.boolean().catch(false),
});

const ERROR_MESSAGES: Record<string, string> = {
	invalid_url: "That doesn't look like a valid, reachable http(s) URL.",
	fetch_failed: "Could not fetch that page — it may be down or blocking requests.",
	not_html: "That URL didn't return an HTML page.",
	no_article_content: "No article content could be extracted from that page.",
	blocked: "That URL points to an internal or disallowed address.",
};

export const Route = createFileRoute("/trace")({
	validateSearch: (search) => searchSchema.parse(search),
	loaderDeps: ({ search }) => ({ url: search.url, firecrawl: search.firecrawl }),
	loader: ({ context: { queryClient }, deps: { url, firecrawl } }) =>
		queryClient.query(traceQueryOptions(url, firecrawl)),
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
	const { url, firecrawl } = Route.useSearch();
	const { data: trace } = useSuspenseQuery(traceQueryOptions(url, firecrawl));
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [transform, setTransform] = useState<GraphTransform>({
		x: 70,
		y: 40,
		scale: 1,
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["trace", url] });

	const findSourcesMutation = useMutation({
		mutationFn: (claimId: number) => findSources({ data: claimId }),
		onSuccess: invalidate,
	});
	const resolveSourceMutation = useMutation({
		mutationFn: (claimSourceId: number) =>
			resolveSource({ data: { claimSourceId, useFirecrawl: firecrawl } }),
		onSuccess: invalidate,
	});

	if (!trace.ok) {
		const canRetryWithFirecrawl =
			!firecrawl && trace.error !== "invalid_url" && trace.error !== "blocked";
		return (
			<div className="workspace">
				<Nav />
				<div className="error-state error-state--column">
					<div>{ERROR_MESSAGES[trace.error] ?? trace.error}</div>
					<div className="error-state__actions">
						<button type="button" className="btn" onClick={() => navigate({ to: "/" })}>
							BACK
						</button>
						{canRetryWithFirecrawl && (
							<FirecrawlToggle
								checked={false}
								onChange={(next) => {
									if (next) navigate({ to: "/trace", search: { url, firecrawl: true } });
								}}
							/>
						)}
					</div>
				</div>
			</div>
		);
	}

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
						{trace.domain} · {trace.publishedAt ?? "date unknown"}
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

			<Timeline entries={trace.timeline} />
			<Inspector
				node={selectedNode}
				trace={trace}
				onFindSources={(claimId) => findSourcesMutation.mutate(claimId)}
				onResolveSource={(claimSourceId) => resolveSourceMutation.mutate(claimSourceId)}
				findSourcesPending={
					findSourcesMutation.isPending &&
					findSourcesMutation.variables === selectedNode?.claimId
				}
				resolveSourcePending={
					resolveSourceMutation.isPending &&
					resolveSourceMutation.variables === selectedNode?.claimSourceId
				}
				findSourcesResult={
					findSourcesMutation.variables === selectedNode?.claimId
						? findSourcesMutation.isError
							? { ok: false as const, error: "request_failed" }
							: findSourcesMutation.data
						: undefined
				}
			/>
		</div>
	);
}
