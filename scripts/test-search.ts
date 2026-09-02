import { config } from "dotenv";
import { searchWeb } from "../src/lib/braveSearch";

config({ path: [".env.local", ".env"] });

const query = process.argv.slice(2).join(" ");

if (!query) {
	console.error("Usage: tsx scripts/test-search.ts <query>");
	process.exit(1);
}

const result = await searchWeb(query);

if (!result.ok) {
	console.error("Search failed:", result.error);
	process.exit(1);
}

console.log(`${result.results.length} results for: "${query}"\n`);
for (const r of result.results) {
	console.log(r.title);
	console.log(" ", r.url);
	console.log(" ", r.publishedAt ?? "(no date)");
	console.log(" ", r.description);
	console.log("");
}
