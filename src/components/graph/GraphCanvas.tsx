import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TraceEdge, TraceNode } from "../../lib/traceGraph";

export interface GraphTransform {
	x: number;
	y: number;
	scale: number;
}

interface Props {
	nodes: TraceNode[];
	edges: TraceEdge[];
	selectedId?: string | null;
	onSelect?: (id: string) => void;
	interactive?: boolean;
	animated?: boolean;
	transform: GraphTransform;
	onTransformChange?: (t: GraphTransform) => void;
}

interface EdgePath {
	id: string;
	d: string;
	from: string;
	to: string;
	copied: boolean;
	weak: boolean;
}

export function clampScale(s: number) {
	return Math.min(2, Math.max(0.5, s));
}

export function GraphCanvas({
	nodes,
	edges,
	selectedId,
	onSelect,
	interactive = true,
	animated = false,
	transform,
	onTransformChange,
}: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const nodeRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
	const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
		null,
	);
	const [paths, setPaths] = useState<EdgePath[]>([]);

	const bounds = useMemo(() => {
		const maxX = Math.max(0, ...nodes.map((n) => n.x)) + 260;
		const maxY = Math.max(0, ...nodes.map((n) => n.y)) + 170;
		return { width: maxX, height: maxY };
	}, [nodes]);

	const recomputeEdges = useCallback(() => {
		const next: EdgePath[] = [];

		for (const e of edges) {
			const from = nodeRefs.current.get(e.from);
			const to = nodeRefs.current.get(e.to);

			if (!from || !to) continue;

			const sx = from.offsetLeft + from.offsetWidth / 2;
			const sy = from.offsetTop + from.offsetHeight;
			const tx = to.offsetLeft + to.offsetWidth / 2;
			const ty = to.offsetTop;
			// Jog just below the source instead of at the sy/ty midpoint: an edge
			// that skips over an intervening row (e.g. article -> claim, past the
			// neighbor-sources row) would otherwise bend its horizontal segment
			// right through that row's cards.
			const gap = ty - sy;
			const jog = Math.min(28, Math.max(8, gap * 0.25));
			const midY = sy + jog;

			next.push({
				id: e.id,
				from: e.from,
				to: e.to,
				copied: e.kind === "copied_from",
				weak: e.confidenceLevel === "low" || e.confidenceLevel === "unverified",
				d: `M ${sx} ${sy} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty}`,
			});
		}

		setPaths(next);
	}, [edges]);

	useEffect(() => {
		recomputeEdges();

		const raf = requestAnimationFrame(recomputeEdges);
		let cancelled = false;

		if (typeof document !== "undefined" && "fonts" in document) {
			document.fonts.ready
				.then(() => !cancelled && recomputeEdges())
				.catch(() => {});
		}

		return () => {
			cancelled = true;
			cancelAnimationFrame(raf);
		};
	}, [recomputeEdges]);

	function set(next: Partial<GraphTransform>) {
		onTransformChange?.({ ...transform, ...next });
	}

	function onPointerDown(ev: React.PointerEvent) {
		if (!interactive) return;
		if ((ev.target as HTMLElement).closest(".node")) return;
		(ev.target as HTMLElement).setPointerCapture(ev.pointerId);
		drag.current = {
			x: ev.clientX,
			y: ev.clientY,
			ox: transform.x,
			oy: transform.y,
		};
	}
	function onPointerMove(ev: React.PointerEvent) {
		if (!drag.current) return;
		const dx = ev.clientX - drag.current.x;
		const dy = ev.clientY - drag.current.y;
		set({ x: drag.current.ox + dx, y: drag.current.oy + dy });
	}
	function onPointerUp() {
		drag.current = null;
	}
	// React's synthetic onWheel is attached as a passive listener, so
	// preventDefault() there can't stop the page from scrolling. A native
	// listener with { passive: false } is the only way to actually block it.
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		function onWheel(ev: WheelEvent) {
			if (!interactive) return;
			ev.preventDefault();
			const next = clampScale(transform.scale - ev.deltaY * 0.001);
			set({ scale: next });
		}

		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	});
	function onNodeDoubleClick(n: TraceNode) {
		if (!interactive || !containerRef.current) return;
		const rect = containerRef.current.getBoundingClientRect();
		const cx = n.x + 104;
		const cy = n.y + 40;
		set({
			x: rect.width / 2 - cx * transform.scale,
			y: rect.height / 2 - cy * transform.scale,
		});
	}

	return (
		<div
			ref={containerRef}
			className={`graph${interactive ? "" : " graph--static"}`}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerLeave={onPointerUp}
		>
			<div
				className="graph__viewport"
				style={{
					transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
				}}
			>
				<svg
					className="graph__edges"
					width={bounds.width}
					height={bounds.height}
					aria-hidden="true"
				>
					{paths.map((p) => {
						const active =
							!!selectedId && (p.from === selectedId || p.to === selectedId);
						const dim = !!selectedId && !active;
						const cls = ["edge"];
						if (p.copied) cls.push("edge--copied");
						if (p.weak) cls.push("edge--weak");
						if (active) cls.push("edge--active");
						if (dim) cls.push("edge--dim");
						if (animated) cls.push("edge--enter");
						const toNode = nodes.find((n) => n.id === p.to);
						const delay =
							animated && toNode ? `${(toNode.y / 150) * 110}ms` : undefined;
						return (
							<path
								key={p.id}
								d={p.d}
								className={cls.join(" ")}
								style={delay ? { animationDelay: delay } : undefined}
							/>
						);
					})}
				</svg>

				{nodes.map((n) => {
					const selected = selectedId === n.id;
					const dim = !!selectedId && !selected;
					const cls = ["node"];
					if (selected) cls.push("node--selected");
					if (dim) cls.push("node--dim");
					if (n.unverified) cls.push("node--unverified");
					if (animated) cls.push("node--enter");
					const delay = animated ? `${(n.y / 150) * 110}ms` : undefined;
					return (
						<button
							key={n.id}
							type="button"
							ref={(el) => {
								if (el) nodeRefs.current.set(n.id, el);
								else nodeRefs.current.delete(n.id);
							}}
							className={cls.join(" ")}
							style={{ left: n.x, top: n.y, animationDelay: delay }}
							onClick={() => interactive && onSelect?.(n.id)}
							onDoubleClick={() => onNodeDoubleClick(n)}
							tabIndex={interactive ? 0 : -1}
						>
							<span className="node__type">{n.type}</span>
							<span className="node__title">{n.title}</span>
							{n.domain && (
								<span className="node__meta">
									{n.domain}
									{n.date ? ` · ${n.date}` : ""}
								</span>
							)}
							{n.unverified && <span className="node__tag">UNVERIFIED</span>}
							{n.copiedBy ? (
								<span className="node__tag">CITED ×{n.copiedBy}</span>
							) : null}
							{n.firstSeen && (
								<span className="node__tag node__tag--accent">FIRST SEEN</span>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
