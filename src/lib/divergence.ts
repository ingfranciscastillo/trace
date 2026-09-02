import { sentenceSimilarity } from "./detectCopies";
import { splitSentences } from "./textUtils";

export type DivergenceStatus =
	| "supported"
	| "paraphrased"
	| "unsupported"
	| "number_mismatch";

export interface DivergenceResult {
	status: DivergenceStatus;
	bestSimilarity: number;
	matchedSentence: string | null;
}

const MIN_SENTENCE_LENGTH = 20;
const SUPPORTED_THRESHOLD = 0.5;
const PARAPHRASED_THRESHOLD = 0.2;
const NUMBER_PATTERN = /\d+(\.\d+)?/g;

function extractNumbers(text: string): string[] {
	return text.match(NUMBER_PATTERN) ?? [];
}

// Best-effort, transparent heuristic: how well does a claim's own wording show
// up in the source it's supposedly drawn from? A strong textual match with a
// different number is flagged specifically — the most concrete form of
// divergence ("the source says 58%, the claim says 62%").
export function computeDivergence(
	claimText: string,
	sourceText: string,
): DivergenceResult {
	const sourceSentences = splitSentences(sourceText).filter(
		(s) => s.length >= MIN_SENTENCE_LENGTH,
	);

	let best: { similarity: number; sentence: string | null } = {
		similarity: 0,
		sentence: null,
	};
	for (const sentence of sourceSentences) {
		const similarity = sentenceSimilarity(claimText, sentence);
		if (similarity > best.similarity) best = { similarity, sentence };
	}

	if (best.similarity >= SUPPORTED_THRESHOLD) {
		const claimNumbers = extractNumbers(claimText);
		const sourceNumbers = best.sentence ? extractNumbers(best.sentence) : [];
		const numbersDiverge = claimNumbers.some((n) => !sourceNumbers.includes(n));
		return {
			status: numbersDiverge ? "number_mismatch" : "supported",
			bestSimilarity: best.similarity,
			matchedSentence: best.sentence,
		};
	}
	if (best.similarity >= PARAPHRASED_THRESHOLD) {
		return {
			status: "paraphrased",
			bestSimilarity: best.similarity,
			matchedSentence: best.sentence,
		};
	}
	return { status: "unsupported", bestSimilarity: best.similarity, matchedSentence: null };
}
