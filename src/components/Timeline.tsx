import type { TimelineEntry } from "../lib/traceGraph";

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
	if (entries.length === 0) {
		return null;
	}

	const dated = entries.filter((e) => e.date !== null);
	const undated = entries.filter((e) => e.date === null);

	return (
		<div className="timeline">
			<div className="timeline__label">TIMELINE</div>
			<div className="timeline__track">
				{dated.map((entry, i) => (
					<div className="timeline__entry" key={`${entry.date}-${entry.label}-${i}`}>
						<div className="timeline__dot" />
						<div className="timeline__date">{entry.date}</div>
						<div className="timeline__body">
							<div className="timeline__entry-title">{entry.label}</div>
							<div className="timeline__entry-domain">{entry.domain}</div>
						</div>
					</div>
				))}
				{undated.length > 0 && (
					<div className="timeline__entry timeline__entry--unknown">
						<div className="timeline__dot timeline__dot--unknown" />
						<div className="timeline__date">UNKNOWN DATE</div>
						<div className="timeline__body">
							{undated.map((entry, i) => (
								<div key={`${entry.label}-${i}`}>
									<div className="timeline__entry-title">{entry.label}</div>
									<div className="timeline__entry-domain">{entry.domain}</div>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
