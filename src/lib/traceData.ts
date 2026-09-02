import { queryOptions } from "@tanstack/react-query";
import { getTrace } from "./traceGraph.functions";

export type {
	EdgeKind,
	NodeType,
	TimelineEntry,
	TraceEdge,
	TraceGraph,
	TraceNode,
} from "./traceGraph";
export type { TraceResult } from "./traceGraph.functions";

export function traceQueryOptions(url: string) {
	return queryOptions({
		queryKey: ["trace", url],
		queryFn: () => getTrace({ data: url }),
	});
}
