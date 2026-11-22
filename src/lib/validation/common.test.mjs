import assert from "node:assert/strict";
import test from "node:test";
import { indianPhoneSchema, normalizeIndianPhone, usernameSchema } from "./common.ts";

test("new usernames require 4-8 allowed characters", () => {
  for (const username of ["abcd", "A_@9", "12345678"]) {
    assert.equal(usernameSchema.safeParse(username).success, true, username);
  }
  for (const username of ["abc", "123456789", "not-valid"]) {
    assert.equal(usernameSchema.safeParse(username).success, false, username);
  }
});

test("accepts Indian phone input used by the phone signup UI", () => {
  for (const phone of ["9482345523", "94823 45523", "+91 94823 45523", "919482345523"]) {
    assert.equal(indianPhoneSchema.safeParse(phone).success, true, phone);
  }
});

test("normalizes supported Indian formats to the national form used by Better Auth", () => {
  assert.equal(normalizeIndianPhone("94823 45523"), "9482345523");
  assert.equal(normalizeIndianPhone("+91 94823 45523"), "9482345523");
  assert.equal(normalizeIndianPhone("919482345523"), "9482345523");
});

test("rejects invalid Indian mobile numbers", () => {
  for (const phone of ["1234567890", "948234552", "+1 9482345523", "abcd"]) {
    assert.equal(indianPhoneSchema.safeParse(phone).success, false, phone);
  }
});
