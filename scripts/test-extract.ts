import { extractArticleImpl } from "../src/lib/extractArticle.functions";

const url = process.argv[2];

if (!url) {
	console.error("Usage: tsx scripts/test-extract.ts <url>");
	process.exit(1);
}

extractArticleImpl(url)
	.then((result) => {
		console.log(JSON.stringify(result, null, 2));
	})
	.catch((error) => {
		console.error("Unexpected error:", error);
		process.exit(1);
	});
