import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "../db";
import { usageCounters } from "../db/schema";
import { consumeCredit } from "./credits";
import { isFirecrawlConfigured } from "./firecrawl";

export type LimitedResource = "brave_search" | "firecrawl";

// Free-tier quotas. Anonymous is a short daily window (pure abuse guard, no
// account to tie a monthly quota to); signed-in is monthly. These are the
// same numbers already agreed as the free tier ahead of a paid credits system.
export const ANONYMOUS_BRAVE_SEARCHES_PER_DAY = 5;
export const FREE_BRAVE_SEARCHES_PER_MONTH = 15;
export const FREE_FIRECRAWL_PER_MONTH = 3;

export function utcDayStart(d = new Date()): Date {
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function utcMonthStart(d = new Date()): Date {
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function getClientIp(headers: Headers): string {
	const forwarded = headers.get("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0]!.trim();
	return headers.get("x-real-ip") ?? "unknown";
}

// Row-locked read-check-increment inside one transaction — safe under
// concurrent requests from the same subject, which a plain upsert wouldn't be
// once the count needs to stop climbing past `limit`.
export async function checkAndConsume(
	subject: string,
	resource: LimitedResource,
	limit: number,
	periodStart: Date,
): Promise<boolean> {
	return db.transaction(async (tx) => {
		const rows = await tx
			.select()
			.from(usageCounters)
			.where(
				and(
					eq(usageCounters.subject, subject),
					eq(usageCounters.resource, resource),
					eq(usageCounters.periodStart, periodStart),
				),
			)
			.for("update");
		const existing = rows[0];

		if (!existing) {
			await tx.insert(usageCounters).values({ subject, resource, periodStart, count: 1 });
			return true;
		}
		if (existing.count >= limit) return false;

		await tx
			.update(usageCounters)
			.set({ count: existing.count + 1 })
			.where(eq(usageCounters.id, existing.id));
		return true;
	});
}

// Brave Search quota check for one findSources call. Consumes on success —
// call this once, right before actually spending the request. Free monthly
// quota first; once that's used up, spend a purchased credit if the account
// has one.
export async function consumeBraveSearchQuota(headers: Headers): Promise<boolean> {
	const session = await auth.api.getSession({ headers });
	if (session) {
		const freeOk = await checkAndConsume(
			`user:${session.user.id}`,
			"brave_search",
			FREE_BRAVE_SEARCHES_PER_MONTH,
			utcMonthStart(),
		);
		if (freeOk) return true;
		return consumeCredit(session.user.id, "brave_search");
	}
	return checkAndConsume(
		`ip:${getClientIp(headers)}`,
		"brave_search",
		ANONYMOUS_BRAVE_SEARCHES_PER_DAY,
		utcDayStart(),
	);
}

// Whether this specific request is allowed to spend a real Firecrawl call.
// Requires an actual session server-side — a request forged without going
// through the UI toggle can't get past this just by setting useFirecrawl.
// Same free-then-credit order as Brave.
export async function canUseFirecrawl(headers: Headers): Promise<boolean> {
	if (!isFirecrawlConfigured()) return false;
	const session = await auth.api.getSession({ headers });
	if (!session) return false;

	const freeOk = await checkAndConsume(
		`user:${session.user.id}`,
		"firecrawl",
		FREE_FIRECRAWL_PER_MONTH,
		utcMonthStart(),
	);
	if (freeOk) return true;
	return consumeCredit(session.user.id, "firecrawl");
}
