import { splitSentences } from "./textUtils";

export interface SharedSentence {
	textA: string;
	textB: string;
	similarity: number;
}

const MIN_SENTENCE_LENGTH = 40;

function normalize(sentence: string): string {
	return sentence
		.toLowerCase()
		.replace(/\[\d+\]/g, "")
		.replace(/[^\p{L}\p{N}\s]/gu, "")
		.replace(/\s+/g, " ")
		.trim();
}

function wordSet(normalized: string): Set<string> {
	return new Set(normalized.split(" ").filter((w) => w.length > 0));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 || b.size === 0) return 0;

	let intersection = 0;
	for (const word of a) {
		if (b.has(word)) intersection += 1;
	}
	const union = a.size + b.size - intersection;
	return union === 0 ? 0 : intersection / union;
}

export function compareArticleText(
	textA: string,
	textB: string,
	minSimilarity = 0.8,
): SharedSentence[] {
	const sentencesA = splitSentences(textA).filter(
		(s) => s.length >= MIN_SENTENCE_LENGTH,
	);
	const sentencesB = splitSentences(textB).filter(
		(s) => s.length >= MIN_SENTENCE_LENGTH,
	);

	const normalizedB = sentencesB.map((sentence) => ({
		sentence,
		normalized: normalize(sentence),
		words: wordSet(normalize(sentence)),
	}));

	const matches: SharedSentence[] = [];

	for (const sentenceA of sentencesA) {
		const normalizedA = normalize(sentenceA);
		if (normalizedA.length === 0) continue;
		const wordsA = wordSet(normalizedA);

		for (const candidate of normalizedB) {
			if (candidate.normalized.length === 0) continue;

			const similarity =
				normalizedA === candidate.normalized
					? 1
					: jaccardSimilarity(wordsA, candidate.words);

			if (similarity >= minSimilarity) {
				matches.push({
					textA: sentenceA,
					textB: candidate.sentence,
					similarity,
				});
			}
		}
	}

	return matches.sort((a, b) => b.similarity - a.similarity);
}
