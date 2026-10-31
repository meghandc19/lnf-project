import assert from "node:assert/strict";
import test from "node:test";
import { editReportSchema, moderationReviewSchema, reportOwnerWhere, reportSchema } from "./report-validation.ts";

const validReport = {
  type: "LOST",
  title: "Black backpack",
  description: "A dark green backpack with a small stitched patch.",
  location: "Main library",
  category: "Wallets & bags",
  color: "Green",
  occurredAt: "2026-10-20T14:30:00.000Z",
};

test("valid lost report parses and normalizes private and identifying fields", () => {
  const parsed = reportSchema.parse({ ...validReport, privateDetails: "A blue notebook inside", brand: "Example" });
  assert.equal(parsed.type, "LOST");
  assert.equal(parsed.occurredAt.toISOString(), validReport.occurredAt);
  assert.equal(parsed.privateDetails, "A blue notebook inside");
});

test("report validation rejects short descriptions, unknown categories, and malformed dates", () => {
  assert.equal(reportSchema.safeParse({ ...validReport, description: "short" }).success, false);
  assert.equal(reportSchema.safeParse({ ...validReport, category: "Other category" }).success, false);
  assert.equal(reportSchema.safeParse({ ...validReport, occurredAt: "tomorrow" }).success, false);
  assert.equal(reportSchema.safeParse({ ...validReport, color: "" }).success, false);
});

test("Other item type stays optional and Jewellery is a supported category", () => {
  assert.equal(reportSchema.safeParse({ ...validReport, category: "Other" }).success, true);
  assert.equal(reportSchema.safeParse({ ...validReport, category: "Other", otherItemType: "Umbrella" }).success, true);
  assert.equal(reportSchema.safeParse({ ...validReport, category: "Jewellery" }).success, true);
  assert.equal(reportSchema.safeParse({ ...validReport, category: "Accessories" }).success, true);
});

test("found report accepts only the supported custody values", () => {
  assert.equal(reportSchema.safeParse({ ...validReport, type: "FOUND", custodyStatus: "SECURITY_OFFICE" }).success, true);
  assert.equal(reportSchema.safeParse({ ...validReport, type: "FOUND", custodyStatus: "AT_HOME" }).success, false);
});

test("edit validation rejects unknown fields and only permits supported lifecycle states", () => {
  const parsed = editReportSchema.parse({ title: "Updated title", category: "Electronics", occurredAt: "2026-10-21T15:00:00.000Z", status: "CLOSED" });
  assert.equal(parsed.status, "CLOSED");
  assert.equal(parsed.occurredAt?.toISOString(), "2026-10-21T15:00:00.000Z");
  assert.equal(editReportSchema.safeParse({ userId: "attacker" }).success, false);
  assert.equal(editReportSchema.safeParse({ status: "APPROVED" }).success, false);
});

test("ownership filter is always scoped to the authenticated owner and active record", () => {
  assert.deepEqual(reportOwnerWhere("report-1", "user-1"), { id: "report-1", userId: "user-1", deletedAt: null });
});

test("moderation accepts only the three server-supported decisions", () => {
  for (const status of ["APPROVED", "FLAGGED", "BLOCKED"]) assert.equal(moderationReviewSchema.safeParse({ status }).success, true);
  assert.equal(moderationReviewSchema.safeParse({ status: "ACTIVE" }).success, false);
  assert.equal(moderationReviewSchema.safeParse({ status: "APPROVED", role: "ADMIN" }).success, false);
});
