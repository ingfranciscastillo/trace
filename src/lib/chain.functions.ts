import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
	DEFAULT_RESULTS_PER_CLAIM,
	findSourcesForClaim,
	resolveClaimSource,
} from "./chainStore";

const findSourcesInput = z.object({
	claimId: z.number().int().positive(),
	maxResults: z.number().int().positive().optional(),
});

// One real Brave Search request — never triggered automatically, only from an
// explicit user click, since it costs real money per request. Asking for more
// than the anonymous default requires a session, same gating shape as the
// Firecrawl switch.
export const findSources = createServerFn({ method: "POST" })
	.validator((data: unknown) => findSourcesInput.parse(data))
	.handler(async ({ data }) => {
		const requestedMax = data.maxResults ?? DEFAULT_RESULTS_PER_CLAIM;
		let effectiveMax = DEFAULT_RESULTS_PER_CLAIM;
		if (requestedMax > DEFAULT_RESULTS_PER_CLAIM) {
			const session = await auth.api.getSession({ headers: getRequestHeaders() });
			if (session) effectiveMax = requestedMax;
		}

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
export const resolveSource = createServerFn({ method: "POST" })
	.validator((data: unknown) => resolveSourceInput.parse(data))
	.handler(async ({ data }) =>
		resolveClaimSource(data.claimSourceId, data.useFirecrawl ?? false),
	);
