import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getMyCredits } from "../lib/credits.functions";

export function CreditsBadge() {
	const { data } = useQuery({
		queryKey: ["my-credits"],
		queryFn: () => getMyCredits(),
	});

	if (!data?.signedIn) return null;

	return (
		<div className="credits-badge">
			<span className="mono">{data.balance} credits</span>
			<Link to="/credits" className="btn">
				BUY CREDITS
			</Link>
		</div>
	);
}
