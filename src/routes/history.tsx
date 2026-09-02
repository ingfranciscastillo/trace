import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
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

function HistoryPage() {
	const { data: articles } = useSuspenseQuery(historyQueryOptions);

	return (
		<div className="about-page">
			<Nav />
			<div className="about-stage">
				<h1>History</h1>
				{articles.length === 0 ? (
					<p className="about-section" style={{ color: "var(--text-muted)" }}>
						Nothing traced yet.
					</p>
				) : (
					<ul className="history-list">
						{articles.map((a) => (
							<li key={a.id}>
								<Link
									to="/trace"
									search={{ url: a.url, firecrawl: false }}
									className="history-item"
								>
									<div className="history-item__title">{a.title}</div>
									<div className="history-item__meta">
										{a.domain} · {a.publishedAt ?? "date unknown"} · fetched{" "}
										{a.fetchedAt.slice(0, 10)}
									</div>
								</Link>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
