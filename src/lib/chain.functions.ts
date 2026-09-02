import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { findSourcesForClaim, resolveClaimSource } from "./chainStore";

// One real Brave Search request — never triggered automatically, only from an
// explicit user click, since it costs real money per request.
export const findSources = createServerFn({ method: "POST" })
	.validator((data: unknown) => z.number().int().positive().parse(data))
	.handler(async ({ data: claimId }) => {
		const result = await findSourcesForClaim(claimId);
		if (!result.ok) return { ok: false as const, error: result.error };
		return { ok: true as const, count: result.results.length };
	});

// One real HTTP fetch to the candidate source's URL, depth-capped and
// dedup-by-URL server-side. Free, but still user-triggered, not automatic.
export const resolveSource = createServerFn({ method: "POST" })
	.validator((data: unknown) => z.number().int().positive().parse(data))
	.handler(async ({ data: claimSourceId }) => resolveClaimSource(claimSourceId));
