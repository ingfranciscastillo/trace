import { useState } from "react";
import { getSession } from "../lib/auth.functions";

const OPTIONS = [3, 5, 10];

export function ResultsCountControl({
	value,
	onChange,
	disabled,
}: {
	value: number;
	onChange: (next: number) => void;
	disabled?: boolean;
}) {
	const [checking, setChecking] = useState(false);
	const [showDialog, setShowDialog] = useState(false);

	async function pick(n: number) {
		if (n <= 3) {
			onChange(n);
			return;
		}
		setChecking(true);
		// A stale/invalid session cookie can make the session check itself throw
		// (rather than just resolving to null) — treat that the same as "not
		// signed in" instead of leaving the control stuck.
		const session = await getSession().catch(() => null);
		setChecking(false);
		if (!session) {
			setShowDialog(true);
			return;
		}
		onChange(n);
	}

	return (
		<>
			<div className="results-count">
				<span className="results-count__label">sources:</span>
				{OPTIONS.map((n) => (
					<button
						key={n}
						type="button"
						className={`results-count__opt${value === n ? " results-count__opt--active" : ""}`}
						disabled={disabled || checking}
						onClick={() => pick(n)}
					>
						{n}
					</button>
				))}
			</div>

			{showDialog && (
				<div className="dialog-overlay" onClick={() => setShowDialog(false)}>
					<div className="dialog" onClick={(e) => e.stopPropagation()}>
						<h3>Sign in required</h3>
						<p>Searching for more than 3 sources per claim requires an account.</p>
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
