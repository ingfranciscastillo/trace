import { parseHTML } from "linkedom";
import { splitSentences } from "./textUtils";

export type ClaimSignal = "statistic" | "attribution" | "citation_marker";

export interface Claim {
	id: string;
	text: string;
	paragraphIndex: number;
	signals: ClaimSignal[];
}

const STATISTIC_PATTERN =
	/\d+(\.\d+)?\s?%|\b\d{1,3}(,\d{3})+(\.\d+)?\b|\b\d+(\.\d+)?\s?(percent|million|billion|thousand|por ciento|millones|mil millones)\b/i;

const ATTRIBUTION_PATTERN =
	/according to|study (found|shows|suggests|found that)|research (shows|found|suggests)|survey (found|shows)|data (shows|suggests|show)|reported by|researchers (found|say|discovered)|analysis (found|shows)|report (found|shows|states)|según|de acuerdo con|un estudio (encontr[oó]|muestra|revel[oó])|la investigaci[oó]n (muestra|encontr[oó])/i;

const CITATION_MARKER_PATTERN = /\[\d+\]/;

const CITATION_ANCHOR_TEXT_PATTERN =
	/\b(study|report|source|data|survey|dataset|paper|findings|research|estudio|informe|fuente|datos|encuesta|investigaci[oó]n)\b/i;

function detectSignals(sentence: string): ClaimSignal[] {
	const signals: ClaimSignal[] = [];
	if (STATISTIC_PATTERN.test(sentence)) signals.push("statistic");
	if (ATTRIBUTION_PATTERN.test(sentence)) signals.push("attribution");
	if (CITATION_MARKER_PATTERN.test(sentence)) signals.push("citation_marker");
	return signals;
}

export function analyzeContent(
	contentHtml: string,
	baseUrl: string,
): { claims: Claim[]; citationHrefs: Set<string> } {
	const claims: Claim[] = [];
	const citationHrefs = new Set<string>();

	if (!contentHtml) return { claims, citationHrefs };

	const { document } = parseHTML(contentHtml, { location: { href: baseUrl } });
	const blocks = Array.from(document.querySelectorAll("p, li, blockquote"));

	let claimCounter = 0;

	blocks.forEach((block, paragraphIndex) => {
		const sentences = splitSentences(block.textContent ?? "");

		for (const sentence of sentences) {
			const signals = detectSignals(sentence);
			if (signals.length > 0) {
				claims.push({
					id: `claim-${claimCounter++}`,
					text: sentence,
					paragraphIndex,
					signals,
				});
			}
		}

		const anchors = Array.from(block.querySelectorAll("a[href]"));
		for (const anchor of anchors) {
			const rawHref = anchor.getAttribute("href");
			if (!rawHref) continue;

			let resolved: URL;
			try {
				resolved = new URL(rawHref, baseUrl);
			} catch {
				continue;
			}
			if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
				continue;
			}

			const anchorText = anchor.textContent ?? "";
			const isCitation =
				CITATION_ANCHOR_TEXT_PATTERN.test(anchorText) ||
				anchor.closest("sup, cite") !== null;

			if (isCitation) {
				citationHrefs.add(resolved.href);
			}
		}
	});

	return { claims, citationHrefs };
}
