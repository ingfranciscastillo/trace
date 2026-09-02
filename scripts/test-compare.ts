import { compareArticleText } from "../src/lib/detectCopies";
import { extractArticleImpl } from "../src/lib/extractArticle.functions";

const urlA = process.argv[2];
const urlB = process.argv[3];

if (!urlA || !urlB) {
	console.error("Usage: tsx scripts/test-compare.ts <urlA> <urlB>");
	process.exit(1);
}

const [resultA, resultB] = await Promise.all([
	extractArticleImpl(urlA),
	extractArticleImpl(urlB),
]);

if (!resultA.ok) {
	console.error("Extraction A failed:", resultA.error);
	process.exit(1);
}
if (!resultB.ok) {
	console.error("Extraction B failed:", resultB.error);
	process.exit(1);
}

const matches = compareArticleText(resultA.textContent, resultB.textContent);

console.log(`${matches.length} shared/similar sentences found:\n`);
for (const match of matches.slice(0, 15)) {
	console.log(`similarity ${match.similarity.toFixed(2)}`);
	console.log(" A:", match.textA);
	console.log(" B:", match.textB);
	console.log("");
}
