import { extractUrlSchema } from "../src/lib/extractArticle.functions";

const url = process.argv[2];

if (!url) {
	console.error("Usage: tsx scripts/test-extract.ts <url>");
	process.exit(1);
}

const parsed = extractUrlSchema.safeParse(url);
if (!parsed.success) {
	console.error("Invalid URL:", parsed.error.issues[0]?.message);
	process.exit(1);
}

console.log("URL is valid:", parsed.data);
