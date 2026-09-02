import assert from "node:assert/strict";
import { computeDivergence } from "../src/lib/divergence";

let r = computeDivergence(
	"A study found that 62% of teachers already use AI in the classroom.",
	"Researchers surveyed thousands of educators. A study found that 62% of teachers already use AI in the classroom, the report concluded. Other findings were less notable.",
);
assert.equal(r.status, "supported");
console.log("PASS: near-identical wording in source -> supported");

r = computeDivergence(
	"A study found that 62% of teachers already use AI in the classroom.",
	"Researchers surveyed thousands of educators. A study found that 58% of teachers already use AI in the classroom, the report concluded. Other findings were less notable.",
);
assert.equal(r.status, "number_mismatch");
console.log("PASS: strong match but different number -> number_mismatch");

r = computeDivergence(
	"Teachers in classrooms are increasingly using AI tools, according to a study.",
	"Researchers surveyed thousands of educators. A study found that 62% of teachers already use AI in the classroom, the report concluded.",
);
assert.equal(r.status, "paraphrased");
console.log("PASS: loose thematic overlap -> paraphrased");

r = computeDivergence(
	"The moon landing was faked according to internet rumors.",
	"Researchers surveyed thousands of educators about classroom technology adoption trends this year.",
);
assert.equal(r.status, "unsupported");
console.log("PASS: no meaningful overlap -> unsupported");

console.log("\nAll divergence tests passed.");
