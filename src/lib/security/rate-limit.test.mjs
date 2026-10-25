import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  checkRateLimit,
  hashRateLimitKey,
} from "./rate-limit.ts";
import {
  assertDevelopmentOtpMode,
  createOtpDelivery,
} from "../auth/sms.ts";

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

test("development OTP delivery logs the generated code and masks the phone", async () => {
  const output = [];
  const deliver = createOtpDelivery({
    nodeEnv: "development",
    enabled: true,
    writeLine: (line) => output.push(line),
  });

  await deliver({ phoneNumber: "+919876543210", code: "482931" });
  assert.equal(output.length, 1);
  assert.match(output[0], /REVOK local development only/);
  assert.match(output[0], /••••3210/);
  assert.match(output[0], /482931/);
  assert.equal(output[0].includes("+919876543210"), false);
});

test("development OTP cannot be enabled outside development or log while disabled", async () => {
  assert.throws(
    () => assertDevelopmentOtpMode("production", true),
    /only be enabled in local development/,
  );

  const output = [];
  const productionDelivery = createOtpDelivery({
    nodeEnv: "production",
    enabled: false,
    writeLine: (line) => output.push(line),
  });
  await assert.rejects(
    productionDelivery({ phoneNumber: "+919876543210", code: "482931" }),
    /OTP delivery is disabled/,
  );
  assert.equal(output.length, 0);
});

test("module startup fails closed when the dev OTP flag is set in production", () => {
  const smsModuleUrl = new URL("../auth/sms.ts", import.meta.url).href;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", `import(${JSON.stringify(smsModuleUrl)})`],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "production",
        REVOK_DEV_OTP_TERMINAL: "true",
      },
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /only be enabled in local development/);
});
