import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Nav } from "../components/Nav";
import { getHistory } from "../lib/history.functions";

const historyQueryOptions = queryOptions({
	queryKey: ["history"],
	queryFn: () => getHistory(),
});

export const Route = createFileRoute("/history")({
	loader: ({ context: { queryClient } }) =>
		queryClient.query(historyQueryOptions),
	component: HistoryPage,
});

function ArticleRow({
	url,
	title,
	domain,
	publishedAt,
	fetchedAt,
}: {
	url: string;
	title: string;
	domain: string;
	publishedAt: string | null;
	fetchedAt: string;
}) {
	return (
		<Link to="/trace" search={{ url, firecrawl: false }} className="history-item">
			<div className="history-item__title">{title}</div>
			<div className="history-item__meta">
				{domain} · {publishedAt ?? "date unknown"} · fetched {fetchedAt.slice(0, 10)}
			</div>
		</Link>
	);
}

function HistoryPage() {
	const { data: history } = useSuspenseQuery(historyQueryOptions);
	const [expanded, setExpanded] = useState<Set<number>>(new Set());

	function toggle(id: number) {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	if (!history.signedIn) {
		return (
			<div className="about-page">
				<Nav />
				<div className="about-stage">
					<h1>History</h1>
					<p className="about-section" style={{ color: "var(--text-muted)" }}>
						History is only kept for signed-in accounts.{" "}
						<Link to="/login" style={{ color: "var(--accent)" }}>
							Sign in
						</Link>{" "}
						or{" "}
						<Link to="/register" style={{ color: "var(--accent)" }}>
							register
						</Link>{" "}
						to start saving one.
					</p>
				</div>
			</div>
		);
	}

	const roots = history.roots;

	return (
		<div className="about-page">
			<Nav />
			<div className="about-stage">
				<h1>History</h1>
				{roots.length === 0 ? (
					<p className="about-section" style={{ color: "var(--text-muted)" }}>
						Nothing traced yet.
					</p>
				) : (
					<ul className="history-list">
						{roots.map((root) => {
							const isOpen = expanded.has(root.id);
							return (
								<li key={root.id} className="history-group">
									<div className="history-group__row">
										<ArticleRow {...root} />
										{root.related.length > 0 && (
											<button
												type="button"
												className={`history-expand${isOpen ? " history-expand--open" : ""}`}
												onClick={() => toggle(root.id)}
												aria-label={isOpen ? "Collapse" : "Expand"}
											>
												▾ {root.related.length}
											</button>
										)}
									</div>
									{isOpen && root.related.length > 0 && (
										<ul className="history-sublist">
											{root.related.map((r) => (
												<li key={r.id}>
													<ArticleRow {...r} />
												</li>
											))}
										</ul>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}
