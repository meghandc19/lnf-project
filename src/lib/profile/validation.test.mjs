import assert from "node:assert/strict";
import test from "node:test";
import { isSafeProfileImage, profileSchema } from "./validation.ts";

test("profile image URLs allow HTTPS and same-site paths only", () => {
  assert.equal(isSafeProfileImage("https://images.example/avatar.png"), true);
  assert.equal(isSafeProfileImage("/avatars/me.png"), true);
  assert.equal(isSafeProfileImage(""), true);
  assert.equal(isSafeProfileImage("http://images.example/avatar.png"), false);
  assert.equal(isSafeProfileImage("//images.example/avatar.png"), false);
  assert.equal(isSafeProfileImage("/\\\\images.example/avatar.png"), false);
  assert.equal(isSafeProfileImage("javascript:alert(1)"), false);
  assert.equal(isSafeProfileImage("https://user:pass@images.example/avatar.png"), false);
});

test("profile data has bounded name/about/image lengths and rejects extra fields", () => {
  assert.equal(profileSchema.safeParse({ name: "Reva", about: "Hello", image: "" }).success, true);
  assert.equal(profileSchema.safeParse({ name: "R", about: "", image: "" }).success, false);
  assert.equal(profileSchema.safeParse({ name: "Reva", about: "x".repeat(281), image: "" }).success, false);
  assert.equal(profileSchema.safeParse({ name: "Reva", about: "", image: "", role: "ADMIN" }).success, false);
});
