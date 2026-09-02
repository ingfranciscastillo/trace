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

const document = __internal.buildDocument(fetched.html, fetched.finalUrl);
const meta = __internal.extractMetaFallback(document);

console.log("Fetched", fetched.html.length, "bytes from", fetched.finalUrl);
console.log("Meta fallback:", meta);

const article = __internal.parseReadableArticle(document, meta);

if (!article) {
	console.error("No article content extracted");
	process.exit(1);
}

console.log("Title:", article.title);
console.log("Author:", article.author);
console.log("Published:", article.publishedAt);
console.log("Text length:", article.textContent.length);
