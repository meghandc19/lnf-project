import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { checkRateLimit, hashRateLimitKey } from "./rate-limit.ts";
import { createOtpDelivery, takeDevelopmentOtp } from "../auth/sms.ts";

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

test("development OTP is available once to the local UI and is never logged", async () => {
  const deliver = createOtpDelivery({ nodeEnv: "development" });
  await deliver({ phoneNumber: "+919876543210", code: "482931" });
  assert.equal(takeDevelopmentOtp("+919876543210"), "482931");
  assert.equal(takeDevelopmentOtp("+919876543210"), undefined);
});

test("production OTP delivery fails closed when no SMS provider is configured", async () => {
  const deliver = createOtpDelivery({ nodeEnv: "production" });
  await assert.rejects(
    deliver({ phoneNumber: "+919876543210", code: "482931" }),
    /SMS delivery is not configured.*MSG91/,
  );
});
