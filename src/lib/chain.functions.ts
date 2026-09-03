import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
	DEFAULT_RESULTS_PER_CLAIM,
	findSourcesForClaim,
	resolveClaimSource,
} from "./chainStore";
import { canUseFirecrawl, consumeBraveSearchQuota } from "./usageLimits";

const findSourcesInput = z.object({
	claimId: z.number().int().positive(),
	maxResults: z.number().int().positive().optional(),
});

// One real Brave Search request — never triggered automatically, only from an
// explicit user click, since it costs real money per request. Asking for more
// than the anonymous default requires a session, same gating shape as the
// Firecrawl switch. Also quota-checked before spending anything: 5/day per IP
// anonymously, 15/month per account signed in — independent of the UI, since
// this same handler is reachable directly without going through the button.
export const findSources = createServerFn({ method: "POST" })
	.validator((data: unknown) => findSourcesInput.parse(data))
	.handler(async ({ data }) => {
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });

		const requestedMax = data.maxResults ?? DEFAULT_RESULTS_PER_CLAIM;
		const effectiveMax = requestedMax > DEFAULT_RESULTS_PER_CLAIM && session
			? requestedMax
			: DEFAULT_RESULTS_PER_CLAIM;

		const allowed = await consumeBraveSearchQuota(headers);
		if (!allowed) return { ok: false as const, error: "quota_exceeded" as const };

		const result = await findSourcesForClaim(data.claimId, effectiveMax);
		if (!result.ok) return { ok: false as const, error: result.error };
		return { ok: true as const, count: result.results.length };
	});

const resolveSourceInput = z.object({
	claimSourceId: z.number().int().positive(),
	useFirecrawl: z.boolean().optional(),
});

// One real HTTP fetch to the candidate source's URL, depth-capped and
// dedup-by-URL server-side. Free, but still user-triggered, not automatic.
// useFirecrawl is re-verified server-side (session + quota) — the UI toggle
// is not the actual gate, since this handler is reachable directly.
export const resolveSource = createServerFn({ method: "POST" })
	.validator((data: unknown) => resolveSourceInput.parse(data))
	.handler(async ({ data }) => {
		const useFirecrawl = data.useFirecrawl
			? await canUseFirecrawl(getRequestHeaders())
			: false;
		return resolveClaimSource(data.claimSourceId, useFirecrawl);
	});
