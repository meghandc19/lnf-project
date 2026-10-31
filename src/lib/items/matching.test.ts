import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSearchText, scorePossibleMatch, searchRelevance, searchTokenVariants } from "./matching.ts";

test("search normalization handles case, spacing, and hyphens", () => {
  assert.equal(normalizeSearchText("  ZEB-MOUSE   CASE "), "zeb mouse case");
});

test("search accepts one letter and a one-character spelling error variant", () => {
  assert.ok(searchRelevance("m", ["Mouse", "Wireless mouse"] ) > 0);
  assert.ok(searchTokenVariants("moues").includes("mous"));
  assert.ok(searchRelevance("moues", ["Mouse", "Wireless mouse"] ) > 0);
});

test("possible match scoring favors similar item, category, and location details", () => {
  const lost = { title: "Zebronics wireless mouse", category: "Electronics", brand: "Zebronics", color: "Black", description: "Black mouse lost near library", location: "College library", occurredAt: new Date("2026-10-20T12:00:00Z") };
  const related = { title: "Black wireless mouse", category: "Electronics", brand: "Zebronics", color: "Black", description: "Zebronics mouse found outside library", location: "College library", occurredAt: new Date("2026-10-21T12:00:00Z") };
  const unrelated = { title: "Blue notebook", category: "Books & stationery", brand: null, color: "Blue", description: "Notebook found in cafeteria", location: "Cafeteria", occurredAt: new Date("2026-10-21T12:00:00Z") };
  assert.ok(scorePossibleMatch(lost, related) >= 45);
  assert.ok(scorePossibleMatch(lost, related) > scorePossibleMatch(lost, unrelated));
});
