import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { checkRateLimit, hashRateLimitKey } from "./rate-limit.ts";
import { getOtpProviderConfig, sendMsg91Otp, verifyMsg91Otp } from "../auth/sms.ts";

test("rate limit allows the configured number of requests then resets", () => {
  const key = hashRateLimitKey("test", randomUUID());
  assert.deepEqual(checkRateLimit(key, 2, 1_000, 10_000), { allowed: true });
  assert.deepEqual(checkRateLimit(key, 2, 1_000, 10_001), { allowed: true });
  assert.deepEqual(checkRateLimit(key, 2, 1_000, 10_002), {
    allowed: false,
    retryAfterMs: 998,
  });
  assert.deepEqual(checkRateLimit(key, 2, 1_000, 11_000), { allowed: true });
});

test("rate limit keys do not retain the supplied phone number", () => {
  const phone = "+919876543210";
  assert.equal(hashRateLimitKey("otp", phone).includes(phone), false);
});

test("MSG91 remains disabled until explicitly enabled and fully configured", () => {
  const previous = Object.fromEntries(["MSG91_ENABLED", "MSG91_AUTH_KEY", "MSG91_OTP_TEMPLATE_ID"].map((key) => [key, process.env[key]]));
  delete process.env.MSG91_ENABLED;
  delete process.env.MSG91_AUTH_KEY;
  delete process.env.MSG91_OTP_TEMPLATE_ID;
  assert.deepEqual(getOtpProviderConfig(), { configured: false, enabled: false, otpLength: 6, otpExpiryMinutes: 5 });
  Object.entries(previous).forEach(([key, value]) => value === undefined ? delete process.env[key] : process.env[key] = value);
});

test("MSG91 send and verify use server credentials and the normalized Indian number", async () => {
  const keys = ["MSG91_ENABLED", "MSG91_AUTH_KEY", "MSG91_OTP_TEMPLATE_ID", "MSG91_OTP_LENGTH", "MSG91_OTP_EXPIRY_MINUTES"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  process.env.MSG91_ENABLED = "true";
  process.env.MSG91_AUTH_KEY = "server-secret-for-test";
  process.env.MSG91_OTP_TEMPLATE_ID = "template-test";
  process.env.MSG91_OTP_LENGTH = "6";
  process.env.MSG91_OTP_EXPIRY_MINUTES = "5";
  const requests = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: new URL(String(input)), init });
    return Response.json({ type: "success", request_id: "test" });
  };
  try {
    await sendMsg91Otp({ phoneNumber: "+919876543210", code: "482931" });
    assert.equal(requests[0].url.searchParams.get("mobile"), "919876543210");
    assert.equal(requests[0].url.searchParams.get("otp"), "482931");
    assert.equal(requests[0].init.headers.authkey, "server-secret-for-test");
    assert.equal(await verifyMsg91Otp({ phoneNumber: "9876543210", code: "482931" }), true);
    globalThis.fetch = async () => Response.json({ type: "error", message: "invalid" });
    assert.equal(await verifyMsg91Otp({ phoneNumber: "9876543210", code: "000000" }), false);
  } finally {
    globalThis.fetch = originalFetch;
    Object.entries(previous).forEach(([key, value]) => value === undefined ? delete process.env[key] : process.env[key] = value);
  }
});

test("MSG91 delivery fails closed when disabled or unconfigured", async () => {
  const keys = ["MSG91_ENABLED", "MSG91_AUTH_KEY", "MSG91_OTP_TEMPLATE_ID"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  delete process.env.MSG91_ENABLED;
  delete process.env.MSG91_AUTH_KEY;
  delete process.env.MSG91_OTP_TEMPLATE_ID;
  try {
    await assert.rejects(sendMsg91Otp({ phoneNumber: "+919876543210", code: "482931" }), /temporarily unavailable/);
  } finally {
    Object.entries(previous).forEach(([key, value]) => value === undefined ? delete process.env[key] : process.env[key] = value);
  }
});
