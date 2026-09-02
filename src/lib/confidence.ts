export type ConfidenceLevel = "high" | "medium" | "low" | "unverified";

// Reasons the system is uncertain, always attached alongside a level rather than
// replacing it — a claim can be e.g. "medium" confidence AND flagged unknown_date.
export type UncertaintyReason = "no_source" | "unknown_date" | "unconfirmed_copy";

export interface Confidence {
	level: ConfidenceLevel;
	reasons: UncertaintyReason[];
}

// A claim has no citation marker, no attribution phrase, and doesn't match any
// other claim in the corpus: nothing at all backs it up. This is the "información
// sin fuente" case — the strongest signal a claim needs scrutiny.
export function claimConfidence(
	signals: string[],
	firstSeenStatus: string | null,
): Confidence {
	const hasCitationMarker = signals.includes("citation_marker");
	const hasAttribution = signals.includes("attribution");
	const corroborated =
		firstSeenStatus === "first_found" || firstSeenStatus === "unverified";
	const dated = firstSeenStatus === "first_found";

	if (!hasCitationMarker && !hasAttribution && !corroborated) {
		return { level: "unverified", reasons: ["no_source"] };
	}

	const reasons: UncertaintyReason[] = corroborated && !dated ? ["unknown_date"] : [];

	if (hasCitationMarker && dated) return { level: "high", reasons };
	if (hasCitationMarker || dated) return { level: "medium", reasons };
	return { level: "low", reasons };
}

// A cites edge always has concrete evidence (the link itself exists) — the only
// question is how deliberately citation-shaped it is, so there is no "unverified" case.
export function citesConfidence(isCitation: boolean): Confidence {
	return isCitation ? { level: "high", reasons: [] } : { level: "low", reasons: [] };
}

export function copiedFromConfidence(
	sharedSentenceCount: number,
	olderArticleId: number | null,
): Confidence {
	const reasons: UncertaintyReason[] =
		olderArticleId === null ? ["unconfirmed_copy"] : [];

	if (sharedSentenceCount >= 5) return { level: "high", reasons };
	if (sharedSentenceCount >= 3) return { level: "medium", reasons };
	return { level: "low", reasons };
}
