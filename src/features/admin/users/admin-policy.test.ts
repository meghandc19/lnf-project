import test from "node:test";
import assert from "node:assert/strict";
import { canChangeManagedRole, canModerateTarget, isEligibleBootstrapAccount, isEligibleForAdminRole } from "./admin-policy.ts";

test("admins may moderate normal accounts but cannot change administrator accounts", () => {
  assert.equal(canModerateTarget("ADMIN", "USER"), true);
  assert.equal(canModerateTarget("ADMIN", "ADMIN"), false);
  assert.equal(canModerateTarget("ADMIN", "SUPER_ADMIN"), false);
});

test("Super Admin can manage normal and admin accounts but cannot manage another Super Admin through user tools", () => {
  assert.equal(canModerateTarget("SUPER_ADMIN", "USER"), true);
  assert.equal(canModerateTarget("SUPER_ADMIN", "ADMIN"), true);
  assert.equal(canModerateTarget("SUPER_ADMIN", "SUPER_ADMIN"), false);
  assert.equal(canChangeManagedRole("SUPER_ADMIN", "USER"), true);
  assert.equal(canChangeManagedRole("SUPER_ADMIN", "ADMIN"), true);
  assert.equal(canChangeManagedRole("SUPER_ADMIN", "SUPER_ADMIN"), false);
});

test("admin appointment requires an active account, username, and verified contact", () => {
  assert.equal(isEligibleForAdminRole({ status: "ACTIVE", username: "reva", emailVerified: true, phoneNumberVerified: false }), true);
  assert.equal(isEligibleForAdminRole({ status: "ACTIVE", username: "reva", emailVerified: false, phoneNumberVerified: true }), true);
  assert.equal(isEligibleForAdminRole({ status: "RESTRICTED", username: "reva", emailVerified: true, phoneNumberVerified: false }), false);
  assert.equal(isEligibleForAdminRole({ status: "ACTIVE", username: null, emailVerified: true, phoneNumberVerified: true }), false);
  assert.equal(isEligibleForAdminRole({ status: "ACTIVE", username: "reva", emailVerified: false, phoneNumberVerified: false }), false);
});

test("bootstrap requires the configured verified Google account and active, undeleted status", () => {
  const configuredEmail = "revok@gmail.com";
  const verifiedGoogleUser = { email: "REVOK@gmail.com", emailVerified: true, status: "ACTIVE", deletedAt: null, providerIds: ["google"] };
  assert.equal(isEligibleBootstrapAccount(configuredEmail, verifiedGoogleUser), true);
  assert.equal(isEligibleBootstrapAccount(configuredEmail, { ...verifiedGoogleUser, email: "someone-else@gmail.com" }), false);
  assert.equal(isEligibleBootstrapAccount(configuredEmail, { ...verifiedGoogleUser, emailVerified: false }), false);
  assert.equal(isEligibleBootstrapAccount(configuredEmail, { ...verifiedGoogleUser, providerIds: [] }), false);
  assert.equal(isEligibleBootstrapAccount(configuredEmail, { ...verifiedGoogleUser, status: "BANNED" }), false);
  assert.equal(isEligibleBootstrapAccount(configuredEmail, { ...verifiedGoogleUser, deletedAt: new Date() }), false);
});
