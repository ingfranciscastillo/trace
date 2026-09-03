import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { authClient } from "../lib/auth-client";
import { getMyCredits } from "../lib/credits.functions";

export function CreditsBadge() {
	const { data } = useQuery({
		queryKey: ["my-credits"],
		queryFn: () => getMyCredits(),
	});
	const [buying, setBuying] = useState(false);

	async function buyCredits() {
		setBuying(true);
		const { data: session, error } = await authClient.dodopayments.checkoutSession({
			slug: "credits-5",
		});
		if (error || !session) {
			setBuying(false);
			console.error("Checkout error:", error);
			return;
		}
		window.location.href = session.url;
	}

	if (!data?.signedIn) return null;

	return (
		<div className="credits-badge">
			<span className="mono">{data.balance} credits</span>
			<button type="button" className="btn" disabled={buying} onClick={buyCredits}>
				{buying ? "…" : "+ BUY 50 / $5"}
			</button>
		</div>
	);
}
