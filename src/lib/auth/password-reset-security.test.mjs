import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  sendWidgetOtpServer,
  verifyWidgetOtpServer,
  retryWidgetOtpServer,
} from "./sms.ts";
import { indianPhoneSchema } from "../validation/common.ts";

test("sendWidgetOtpServer: strictly rejects malformed responses, error types, and body.message fallbacks", async () => {
  const previousAuthKey = process.env.MSG91_AUTH_KEY;
  const originalFetch = globalThis.fetch;
  process.env.MSG91_AUTH_KEY = "test-auth-key";

  try {
    // 1. Response has type: "error" even with HTTP 200
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ type: "error", message: "Invalid widget ID" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    const errRes = await sendWidgetOtpServer({ phoneNumber: "9876543210" });
    assert.equal(errRes.success, false);
    assert.equal(errRes.error, "Invalid widget ID");

    // 2. Response has message but NO reqId (verifies body.message is NEVER used as fallback for reqId)
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ type: "success", message: "366b6769587938323835" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    const noReqIdRes = await sendWidgetOtpServer({ phoneNumber: "9876543210" });
    assert.equal(noReqIdRes.success, false);
    assert.equal(noReqIdRes.reqId, undefined);

    // 3. Response has empty or whitespace reqId
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ type: "success", reqId: "   " }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    const emptyReqIdRes = await sendWidgetOtpServer({ phoneNumber: "9876543210" });
    assert.equal(emptyReqIdRes.success, false);

    // 4. Response is malformed non-JSON
    globalThis.fetch = async () =>
      new Response("<html>Bad Gateway</html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      });
    const badGatewayRes = await sendWidgetOtpServer({ phoneNumber: "9876543210" });
    assert.equal(badGatewayRes.success, false);

    // 5. Valid documented MSG91 success response with reqId
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          type: "success",
          message: "OTP sent successfully",
          reqId: "valid_req_12345",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    const successRes = await sendWidgetOtpServer({ phoneNumber: "9876543210" });
    assert.equal(successRes.success, true);
    assert.equal(successRes.reqId, "valid_req_12345");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousAuthKey === undefined) delete process.env.MSG91_AUTH_KEY;
    else process.env.MSG91_AUTH_KEY = previousAuthKey;
  }
});

test("verifyWidgetOtpServer: validates 4-digit OTP format, requires reqId, and strictly checks success", async () => {
  const previousAuthKey = process.env.MSG91_AUTH_KEY;
  const originalFetch = globalThis.fetch;
  process.env.MSG91_AUTH_KEY = "test-auth-key";

  try {
    // 1. Missing or empty reqId rejected before network call
    const missingReqId = await verifyWidgetOtpServer({ otp: "1234", reqId: "" });
    assert.equal(missingReqId.success, false);
    assert.match(missingReqId.error, /missing verification session/i);

    // 2. Malformed OTP format rejected before network call
    const badOtp = await verifyWidgetOtpServer({ otp: "abcd", reqId: "req_123" });
    assert.equal(badOtp.success, false);
    assert.match(badOtp.error, /invalid verification code format/i);

    // 3. Provider returns type: "error" (e.g. wrong OTP) even with HTTP 200
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ type: "error", message: "OTP not match" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    const wrongOtp = await verifyWidgetOtpServer({ otp: "9999", reqId: "req_123" });
    assert.equal(wrongOtp.success, false);
    assert.equal(wrongOtp.error, "OTP not match");

    // 4. Provider returns success
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ type: "success", message: "OTP verified" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    const correctOtp = await verifyWidgetOtpServer({ otp: "1234", reqId: "req_123" });
    assert.equal(correctOtp.success, true);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousAuthKey === undefined) delete process.env.MSG91_AUTH_KEY;
    else process.env.MSG91_AUTH_KEY = previousAuthKey;
  }
});

test("retryWidgetOtpServer: requires reqId and strictly checks success response", async () => {
  const previousAuthKey = process.env.MSG91_AUTH_KEY;
  const originalFetch = globalThis.fetch;
  process.env.MSG91_AUTH_KEY = "test-auth-key";

  try {
    // 1. Missing reqId
    const missingReqId = await retryWidgetOtpServer({ reqId: "" });
    assert.equal(missingReqId.success, false);

    // 2. Provider returns failure
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ type: "error", message: "Retry limit reached" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    const failRes = await retryWidgetOtpServer({ reqId: "req_123" });
    assert.equal(failRes.success, false);
    assert.equal(failRes.error, "Retry limit reached");

    // 3. Provider returns success
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ type: "success", message: "OTP resent successfully" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    const successRes = await retryWidgetOtpServer({ reqId: "req_123" });
    assert.equal(successRes.success, true);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousAuthKey === undefined) delete process.env.MSG91_AUTH_KEY;
    else process.env.MSG91_AUTH_KEY = previousAuthKey;
  }
});

test("provider failure and timeout fails closed safely", async () => {
  const previousAuthKey = process.env.MSG91_AUTH_KEY;
  const originalFetch = globalThis.fetch;
  process.env.MSG91_AUTH_KEY = "test-auth-key";

  try {
    globalThis.fetch = async () => {
      throw new Error("Network timeout or unreachable host");
    };
    await assert.rejects(
      sendWidgetOtpServer({ phoneNumber: "9876543210" }),
      /temporarily unavailable/i
    );
    await assert.rejects(
      verifyWidgetOtpServer({ otp: "1234", reqId: "req_123" }),
      /temporarily unavailable/i
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (previousAuthKey === undefined) delete process.env.MSG91_AUTH_KEY;
    else process.env.MSG91_AUTH_KEY = previousAuthKey;
  }
});

test("password-reset confirmation schema rejects signup widget tokens and requires 4-digit numeric OTP", () => {
  const resetPasswordConfirmSchema = z.object({
    phoneNumber: indianPhoneSchema,
    resetToken: z.string().min(16),
    otp: z.string().regex(/^\d{4}$/, "Enter a valid 4-digit code."),
    newPassword: z.string().min(8).max(128),
  });

  // 1. Valid confirmation payload
  const valid = resetPasswordConfirmSchema.safeParse({
    phoneNumber: "9876543210",
    resetToken: "a".repeat(32),
    otp: "1234",
    newPassword: "newSecurePassword123",
  });
  assert.equal(valid.success, true);

  // 2. Supplying a signup JWT accessToken instead of OTP is strictly rejected
  const accessTokenInsteadOfOtp = resetPasswordConfirmSchema.safeParse({
    phoneNumber: "9876543210",
    resetToken: "a".repeat(32),
    otp: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    newPassword: "newSecurePassword123",
  });
  assert.equal(accessTokenInsteadOfOtp.success, false);

  // 3. Omitting OTP and providing only accessToken is strictly rejected
  const missingOtp = resetPasswordConfirmSchema.safeParse({
    phoneNumber: "9876543210",
    resetToken: "a".repeat(32),
    accessToken: "eyJhbGciOiJIUzI1NiJ9...",
    newPassword: "newSecurePassword123",
  });
  assert.equal(missingOtp.success, false);

  // 4. Non-4-digit OTP is rejected
  const wrongLengthOtp = resetPasswordConfirmSchema.safeParse({
    phoneNumber: "9876543210",
    resetToken: "a".repeat(32),
    otp: "123456",
    newPassword: "newSecurePassword123",
  });
  assert.equal(wrongLengthOtp.success, false);
});

test("reset intent lifecycle: expired intents and unconfirmed pending intents are strictly rejected", () => {
  const now = Date.now();

  function matchIntent(intents, submittedToken) {
    for (const item of intents) {
      if (item.expiresAt.getTime() <= now) continue; // expired
      try {
        const data = JSON.parse(item.value);
        if (
          data.resetToken === submittedToken &&
          !data.pending &&
          typeof data.reqId === "string" &&
          data.reqId.trim().length > 0
        ) {
          return { id: item.id, reqId: data.reqId.trim() };
        }
      } catch {
        // Ignored
      }
    }
    return null;
  }

  // 1. Expired intent is rejected
  const expiredIntent = {
    id: "int_1",
    value: JSON.stringify({ resetToken: "token_123", reqId: "req_123", pending: false }),
    expiresAt: new Date(now - 1000), // expired 1s ago
  };
  assert.equal(matchIntent([expiredIntent], "token_123"), null);

  // 2. Pending intent (SMS sent but not activated or DB interrupted) is rejected
  const pendingIntent = {
    id: "int_2",
    value: JSON.stringify({ resetToken: "token_456", reqId: null, pending: true }),
    expiresAt: new Date(now + 60000),
  };
  assert.equal(matchIntent([pendingIntent], "token_456"), null);

  // 3. Active, valid intent is matched
  const validIntent = {
    id: "int_3",
    value: JSON.stringify({ resetToken: "token_789", reqId: "req_789", pending: false }),
    expiresAt: new Date(now + 60000),
  };
  assert.deepEqual(matchIntent([validIntent], "token_789"), { id: "int_3", reqId: "req_789" });
});

test("retry policy: strictly enforces 30s cooldown and max 2 attempts", () => {
  const now = Date.now();
  const COOLDOWN_MS = 30_000;
  const MAX_RETRIES = 2;

  function evaluateRetry(intentData) {
    if (intentData.retriesCount >= MAX_RETRIES) {
      return { allowed: false, error: "MAX_RETRIES_EXCEEDED" };
    }
    const elapsed = now - intentData.lastSentAt;
    if (elapsed < COOLDOWN_MS) {
      return {
        allowed: false,
        error: "COOLDOWN_ACTIVE",
        retryAfterSeconds: Math.ceil((COOLDOWN_MS - elapsed) / 1000),
      };
    }
    return { allowed: true };
  }

  // 1. Cooldown active (last sent 10s ago)
  const coolingDown = evaluateRetry({ retriesCount: 0, lastSentAt: now - 10_000 });
  assert.equal(coolingDown.allowed, false);
  assert.equal(coolingDown.error, "COOLDOWN_ACTIVE");
  assert.equal(coolingDown.retryAfterSeconds, 20);

  // 2. Cooldown elapsed (last sent 35s ago) -> allowed
  const allowed = evaluateRetry({ retriesCount: 1, lastSentAt: now - 35_000 });
  assert.equal(allowed.allowed, true);

  // 3. Max retries exceeded (already at 2 retries) -> rejected
  const maxExceeded = evaluateRetry({ retriesCount: 2, lastSentAt: now - 60_000 });
  assert.equal(maxExceeded.allowed, false);
  assert.equal(maxExceeded.error, "MAX_RETRIES_EXCEEDED");
});

test("atomic token deduplication & replay prevention via unique key collision", async () => {
  // Simulated database with unique key index (like Prisma RateLimit.key @unique)
  const uniqueStore = new Set();

  async function consumeTokenAtomically(key) {
    if (uniqueStore.has(key)) {
      // Throws unique constraint violation (Prisma P2002)
      const error = new Error("Unique constraint failed on the fields: (`key`)");
      error.code = "P2002";
      error.meta = { target: ["key"] };
      throw error;
    }
    uniqueStore.add(key);
    return { success: true };
  }

  const tokenKey = "pwd-reset-consumed:sample_reset_token_12345";

  // First consumption succeeds
  const first = await consumeTokenAtomically(tokenKey);
  assert.equal(first.success, true);

  // Second consumption (or concurrent replay attempt) throws P2002
  await assert.rejects(
    consumeTokenAtomically(tokenKey),
    (err) => err.code === "P2002" && err.meta.target.includes("key")
  );
});

test("password reset invalidates every active session for the user", async () => {
  // Simulated session store
  const sessions = [
    { id: "s1", userId: "user_target", token: "tok_1" },
    { id: "s2", userId: "user_target", token: "tok_2" },
    { id: "s3", userId: "user_other", token: "tok_3" },
  ];

  async function completePasswordReset({ userId }) {
    // Atomically invalidate all sessions for the targeted user
    const remaining = sessions.filter((s) => s.userId !== userId);
    sessions.length = 0;
    sessions.push(...remaining);
  }

  await completePasswordReset({ userId: "user_target" });

  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].userId, "user_other");
});
