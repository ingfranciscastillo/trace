import assert from "node:assert/strict";
import {
	citesConfidence,
	claimConfidence,
	copiedFromConfidence,
} from "../src/lib/confidence";

// claimConfidence

let r = claimConfidence([], "no_matches");
assert.equal(r.level, "unverified");
assert.deepEqual(r.reasons, ["no_source"]);
console.log("PASS: no signals + no corroboration -> unverified/no_source");

r = claimConfidence(["statistic"], "no_matches");
assert.equal(r.level, "unverified");
assert.deepEqual(r.reasons, ["no_source"]);
console.log("PASS: bare statistic with no attribution/marker/corroboration -> unverified/no_source");

r = claimConfidence(["citation_marker"], "first_found");
assert.equal(r.level, "high");
assert.deepEqual(r.reasons, []);
console.log("PASS: citation marker + dated corroboration -> high");

r = claimConfidence(["citation_marker"], "unverified");
assert.equal(r.level, "medium");
assert.deepEqual(r.reasons, ["unknown_date"]);
console.log("PASS: citation marker + undated corroboration -> medium/unknown_date");

r = claimConfidence([], "first_found");
assert.equal(r.level, "medium");
assert.deepEqual(r.reasons, []);
console.log("PASS: no marker but dated corroboration -> medium");

r = claimConfidence(["attribution"], "no_matches");
assert.equal(r.level, "low");
assert.deepEqual(r.reasons, []);
console.log("PASS: attribution phrase alone, no corroboration -> low");

r = claimConfidence([], "unverified");
assert.equal(r.level, "low");
assert.deepEqual(r.reasons, ["unknown_date"]);
console.log("PASS: undated corroboration only -> low/unknown_date");

// citesConfidence

assert.deepEqual(citesConfidence(true), { level: "high", reasons: [] });
assert.deepEqual(citesConfidence(false), { level: "low", reasons: [] });
console.log("PASS: cites confidence keyed on isCitation, never unverified");

// copiedFromConfidence

r = copiedFromConfidence(2, null);
assert.equal(r.level, "low");
assert.deepEqual(r.reasons, ["unconfirmed_copy"]);
console.log("PASS: minimum shared sentences + no date -> low/unconfirmed_copy");

r = copiedFromConfidence(4, 1);
assert.equal(r.level, "medium");
assert.deepEqual(r.reasons, []);
console.log("PASS: 4 shared sentences + confirmed direction -> medium, no reasons");

r = copiedFromConfidence(6, null);
assert.equal(r.level, "high");
assert.deepEqual(r.reasons, ["unconfirmed_copy"]);
console.log("PASS: strong overlap but unresolved direction -> high/unconfirmed_copy");

console.log("\nAll confidence tests passed.");
