import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Nav } from "../components/Nav";
import { authClient } from "../lib/auth-client";
import { CREDIT_PACKS } from "../lib/creditPacks";
import { getMyCredits } from "../lib/credits.functions";

export const Route = createFileRoute("/credits")({
	component: CreditsPage,
});

function CreditsPage() {
	const { data } = useQuery({
		queryKey: ["my-credits"],
		queryFn: () => getMyCredits(),
	});
	const [buyingSlug, setBuyingSlug] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function buy(slug: string) {
		setError(null);
		setBuyingSlug(slug);
		const { data: session, error: checkoutError } = await authClient.dodopayments.checkoutSession({
			slug,
		});
		if (checkoutError || !session) {
			setBuyingSlug(null);
			setError("Could not start checkout. Please try again.");
			console.error("Checkout error:", checkoutError);
			return;
		}
		window.location.href = session.url;
	}

	return (
		<div className="credits-page">
			<Nav />
			<div className="credits-stage">
				<div className="credits-stage__eyebrow">CREDITS</div>
				<h1>Top up your balance.</h1>
				<p className="credits-stage__intro">
					Buy once, spend whenever you need extra source searches or fetches.
					No subscription, nothing expires.
				</p>

				{data?.signedIn && (
					<div className="credits-balance">
						CURRENT BALANCE
						<b>{data.balance} credits</b>
					</div>
				)}
				{error && <div className="auth-card__error">{error}</div>}

				<div className="credit-packs">
					{CREDIT_PACKS.map((pack) => (
						<div
							key={pack.slug}
							className={
								pack.popular ? "credit-pack credit-pack--popular" : "credit-pack"
							}
						>
							{pack.popular && <div className="credit-pack__badge">MOST POPULAR</div>}
							<div className="credit-pack__label">{pack.label}</div>
							<div className="credit-pack__price">${pack.priceUsd}</div>
							<div className="credit-pack__credits">{pack.credits} credits</div>
							<div className="credit-pack__rate">
								{((pack.priceUsd / pack.credits) * 100).toFixed(2)}¢ / credit
							</div>
							{data?.signedIn ? (
								<button
									type="button"
									className="btn btn--accent"
									disabled={buyingSlug === pack.slug}
									onClick={() => buy(pack.slug)}
								>
									{buyingSlug === pack.slug ? "…" : "BUY"}
								</button>
							) : (
								<Link to="/login" className="btn">
									SIGN IN TO BUY
								</Link>
							)}
						</div>
					))}
				</div>

				<div className="credits-faq">
					<h2>FAQ</h2>
					<div className="credits-faq__item">
						<div className="credits-faq__q">What's a credit?</div>
						<div className="credits-faq__a">
							1 credit = 1 Brave source search, or 1 Firecrawl page fetch. Same
							price either way — whichever you use, it costs one credit.
						</div>
					</div>
					<div className="credits-faq__item">
						<div className="credits-faq__q">Do I need credits to use Trace?</div>
						<div className="credits-faq__a">
							No. Every registered account gets 15 free source searches and 3
							free Firecrawl fetches every month. Credits only come into play
							once that free quota runs out for the month.
						</div>
					</div>
					<div className="credits-faq__item">
						<div className="credits-faq__q">Do credits expire?</div>
						<div className="credits-faq__a">
							No. It's a one-time purchase, not a subscription — your balance
							carries over indefinitely until you spend it.
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
