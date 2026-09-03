import type { WebhookPayload } from "@dodopayments/core";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { creditBalances, creditTransactions } from "../db/schema";
import { CREDIT_PACKS, dodoProductIdEnvVar } from "./creditPacks";

export type CreditReason = "purchase" | "brave_search" | "firecrawl";

// 1 credit = 1 Brave search = 1 Firecrawl page, unified — at the real rates
// ($5/1000 Brave, ~$0.005/page Firecrawl overage) they cost us the same.
// Maps a Dodo product id to how many credits a purchase of it grants.
const CREDITS_BY_PRODUCT_ID: Record<string, number> = Object.fromEntries(
	CREDIT_PACKS.flatMap((pack) => {
		const productId = process.env[dodoProductIdEnvVar(pack.slug)];
		return productId ? [[productId, pack.credits]] : [];
	}),
);

export async function getCreditBalance(userId: string): Promise<number> {
	const [row] = await db
		.select()
		.from(creditBalances)
		.where(eq(creditBalances.userId, userId));
	return row?.balance ?? 0;
}

// Idempotent on dodoPaymentId — replaying the same webhook (Dodo retries on
// timeout) must never double-credit. The unique index on dodoPaymentId makes
// the second insert a no-op via onConflictDoNothing rather than needing a
// pre-check-then-insert race.
export async function addCredits(
	userId: string,
	amount: number,
	reason: CreditReason,
	dodoPaymentId?: string,
): Promise<void> {
	await db.transaction(async (tx) => {
		const inserted = await tx
			.insert(creditTransactions)
			.values({ userId, amount, reason, dodoPaymentId })
			.onConflictDoNothing({ target: creditTransactions.dodoPaymentId })
			.returning({ id: creditTransactions.id });

		// A conflict means this payment was already credited in an earlier
		// (possibly retried) webhook delivery — skip the balance update too.
		if (dodoPaymentId && inserted.length === 0) return;

		await tx
			.insert(creditBalances)
			.values({ userId, balance: amount })
			.onConflictDoUpdate({
				target: creditBalances.userId,
				set: {
					balance: sql`${creditBalances.balance} + ${amount}`,
					updatedAt: new Date(),
				},
			});
	});
}

// Row-locked read-check-decrement, same shape as usageLimits' checkAndConsume
// — a plain balance-sum-over-transactions read would race under concurrent
// spends and could let balance go negative.
export async function consumeCredit(
	userId: string,
	reason: Exclude<CreditReason, "purchase">,
): Promise<boolean> {
	return db.transaction(async (tx) => {
		const rows = await tx
			.select()
			.from(creditBalances)
			.where(eq(creditBalances.userId, userId))
			.for("update");
		const existing = rows[0];
		if (!existing || existing.balance <= 0) return false;

		await tx
			.update(creditBalances)
			.set({ balance: existing.balance - 1, updatedAt: new Date() })
			.where(eq(creditBalances.userId, userId));
		await tx.insert(creditTransactions).values({ userId, amount: -1, reason });
		return true;
	});
}

export async function onCreditPurchase(payload: WebhookPayload): Promise<void> {
	if (payload.type !== "payment.succeeded") return;
	const { data } = payload;

	const userId = data.customer.metadata?.better_auth_user_id;
	if (typeof userId !== "string" || !userId) {
		console.error("Dodo webhook: could not resolve better_auth_user_id from payload", data);
		return;
	}

	let totalCredits = 0;
	for (const item of data.product_cart ?? []) {
		const perUnit = CREDITS_BY_PRODUCT_ID[item.product_id];
		if (perUnit) totalCredits += perUnit * item.quantity;
	}

	if (totalCredits <= 0) {
		console.error("Dodo webhook: no known credit pack in purchase", data);
		return;
	}

	await addCredits(userId, totalCredits, "purchase", data.payment_id);
}
