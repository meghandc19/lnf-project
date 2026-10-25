import assert from "node:assert/strict";
import test from "node:test";
import {
  canBrowse,
  canCreateReport,
  canMessage,
  canClaim,
  canAccessApplication,
} from "./access.ts";

test("restricted accounts may browse but cannot perform protected actions", () => {
  assert.equal(canBrowse("RESTRICTED"), true);
  assert.equal(canAccessApplication("RESTRICTED"), true);
  assert.equal(canCreateReport("RESTRICTED", true), false);
  assert.equal(canMessage("RESTRICTED", true), false);
  assert.equal(canClaim("RESTRICTED", true), false);
});

test("banned and deleted accounts cannot access the application", () => {
  assert.equal(canBrowse("BANNED"), false);
  assert.equal(canAccessApplication("BANNED"), false);
  assert.equal(canAccessApplication("DELETED"), false);
});

test("active accounts need verified phones for protected actions", () => {
  assert.equal(canBrowse("ACTIVE"), true);
  assert.equal(canCreateReport("ACTIVE", false), false);
  assert.equal(canCreateReport("ACTIVE", true), true);
});
