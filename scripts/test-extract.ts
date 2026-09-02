import {
	extractUrlSchema,
	__internal,
} from "../src/lib/extractArticle.functions";

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

const fetched = await __internal.fetchHtml(parsed.data);
if (!fetched.ok) {
	console.error("Fetch failed:", fetched.error);
	process.exit(1);
}

console.log("Fetched", fetched.html.length, "bytes from", fetched.finalUrl);
