import { useState } from "react";
import { getSession } from "../lib/auth.functions";
import { getFirecrawlStatus } from "../lib/traceGraph.functions";

type DialogKind = "login_required" | "not_configured" | null;

export function FirecrawlToggle({
	checked,
	onChange,
}: {
	checked: boolean;
	onChange: (next: boolean) => void;
}) {
	const [checking, setChecking] = useState(false);
	const [dialog, setDialog] = useState<DialogKind>(null);

	async function handleChange() {
		if (checked) {
			onChange(false);
			return;
		}

		setChecking(true);
		const session = await getSession();
		if (!session) {
			setChecking(false);
			setDialog("login_required");
			return;
		}

		const status = await getFirecrawlStatus();
		setChecking(false);

		if (!status.configured) {
			setDialog("not_configured");
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

			{dialog && (
				<div className="dialog-overlay" onClick={() => setDialog(null)}>
					<div className="dialog" onClick={(e) => e.stopPropagation()}>
						{dialog === "login_required" ? (
							<>
								<h3>Sign in required</h3>
								<p>Using Firecrawl requires an account. Sign up or log in first.</p>
							</>
						) : (
							<>
								<h3>No Firecrawl session</h3>
								<p>
									This server has no Firecrawl API key configured, so the switch
									has nothing to fall back to. Extraction will keep using a
									plain fetch, which some sites (Cloudflare, Akamai, etc.) will
									block.
								</p>
							</>
						)}
						<button type="button" className="btn" onClick={() => setDialog(null)}>
							OK
						</button>
					</div>
				</div>
			)}
		</>
	);
}
