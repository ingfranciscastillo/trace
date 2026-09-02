import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { claimSources, claims } from "../src/db/schema";
import { findSourcesForClaim, resolveClaimSource } from "../src/lib/chainStore";

const mode = process.argv[2];
const idArg = process.argv[3];

if ((mode !== "find" && mode !== "resolve") || !idArg) {
	console.error("Usage:");
	console.error("  tsx scripts/test-chain.ts find <claimId>       # 1 Brave Search call");
	console.error("  tsx scripts/test-chain.ts resolve <claimSourceId>  # 1 real HTTP fetch");
	process.exit(1);
}

const id = Number(idArg);

if (mode === "find") {
	const [claim] = await db.select().from(claims).where(eq(claims.id, id));
	if (!claim) {
		console.error(`Claim ${id} not found`);
		process.exit(1);
	}
	console.log("Claim:", claim.text);

	const result = await findSourcesForClaim(id);
	if (!result.ok) {
		console.error("Search failed:", result.error);
		process.exit(1);
	}

	console.log(`\n${result.results.length} candidate sources saved:\n`);
	const stored = await db
		.select()
		.from(claimSources)
		.where(eq(claimSources.claimId, id));
	for (const s of stored) {
		console.log(` [${s.id}]`, s.title);
		console.log("     ", s.url, s.publishedAt ?? "(no date)");
	}
} else {
	const result = await resolveClaimSource(id);
	console.log("Result:", result);
}

await db.$client.end();
