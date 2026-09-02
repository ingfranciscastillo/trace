import { extractArticleImpl } from "../src/lib/extractArticle.functions";

const url = process.argv[2];

if (!url) {
	console.error("Usage: tsx scripts/test-extract.ts <url>");
	process.exit(1);
}

extractArticleImpl(url)
	.then((result) => {
		console.log(JSON.stringify(result, null, 2));

		if (result.ok) {
			console.log(`\n${result.claims.length} claims found:`);
			for (const claim of result.claims.slice(0, 10)) {
				console.log(
					` - [p${claim.paragraphIndex}] (${claim.signals.join(", ")}) ${claim.text}`,
				);
			}

			const citationLinks = result.links.filter((l) => l.isCitation);
			console.log(`\n${citationLinks.length} links flagged as citations:`);
			for (const link of citationLinks.slice(0, 10)) {
				console.log(` - ${link.href}`);
			}
		}
	})
	.catch((error) => {
		console.error("Unexpected error:", error);
		process.exit(1);
	});
