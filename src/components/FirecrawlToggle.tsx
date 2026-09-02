import { useState } from "react";
import { getFirecrawlStatus } from "../lib/traceGraph.functions";

export function FirecrawlToggle({
	checked,
	onChange,
}: {
	checked: boolean;
	onChange: (next: boolean) => void;
}) {
	const [checking, setChecking] = useState(false);
	const [showDialog, setShowDialog] = useState(false);

	async function handleChange() {
		if (checked) {
			onChange(false);
			return;
		}

		setChecking(true);
		const status = await getFirecrawlStatus();
		setChecking(false);

		if (!status.configured) {
			setShowDialog(true);
			return;
		}
		onChange(true);
	}

	return (
		<>
			<label className="firecrawl-switch">
				<button
					type="button"
					role="switch"
					aria-checked={checked}
					className={`switch${checked ? " switch--on" : ""}`}
					disabled={checking}
					onClick={handleChange}
				>
					<span className="switch__thumb" />
				</button>
				<span>{checking ? "checking session…" : "use Firecrawl if blocked"}</span>
			</label>

			{showDialog && (
				<div className="dialog-overlay" onClick={() => setShowDialog(false)}>
					<div className="dialog" onClick={(e) => e.stopPropagation()}>
						<h3>No Firecrawl session</h3>
						<p>
							This server has no Firecrawl API key configured, so the switch
							has nothing to fall back to. Extraction will keep using a plain
							fetch, which some sites (Cloudflare, Akamai, etc.) will block.
						</p>
						<button
							type="button"
							className="btn"
							onClick={() => setShowDialog(false)}
						>
							OK
						</button>
					</div>
				</div>
			)}
		</>
	);
}
