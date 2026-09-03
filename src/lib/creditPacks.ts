export interface CreditPack {
	slug: string;
	priceUsd: number;
	credits: number;
	label: string;
	popular?: boolean;
}

// Per-credit price improves at higher packs (10.0¢ -> 7.14¢) to reward
// bigger one-time purchases, without needing a subscription. Real cost is
// ~0.5¢/credit (Brave $5/1000, Firecrawl overage $5/1000), so margin stays
// wide across every tier.
export const CREDIT_PACKS: CreditPack[] = [
	{ slug: "credits-5", priceUsd: 5, credits: 50, label: "Starter" },
	{ slug: "credits-15", priceUsd: 15, credits: 175, label: "Standard", popular: true },
	{ slug: "credits-40", priceUsd: 40, credits: 500, label: "Pro" },
	{ slug: "credits-100", priceUsd: 100, credits: 1400, label: "Power" },
];

export function dodoProductIdEnvVar(slug: string): string {
	return `DODO_PRODUCT_ID_${slug.toUpperCase().replace(/-/g, "_")}`;
}
