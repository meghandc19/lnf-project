import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { handleApiError } from "@/lib/api/handle-error";

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return Response.json(
        { error: "ORIGIN_NOT_ALLOWED", message: "This password reset request is not allowed." },
        { status: 403 },
      );
    }

    const ip = request.headers.get("x-forwarded-for") || "unknown-ip";
    const ipLimit = checkRateLimit(hashRateLimitKey("pwd-reset-request-ip", ip), 10, 60 * 60 * 1000);
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterMs);

    const body = (await request.json().catch(() => null)) as { phoneNumber?: unknown } | null;
    const parsed = indianPhoneSchema.safeParse(body?.phoneNumber);
    if (!parsed.success) {
      return Response.json(
        { error: "INVALID_PHONE_NUMBER", message: "Enter a valid 10-digit Indian mobile number." },
        { status: 400 },
      );
    }

    const normalizedPhone = normalizeIndianPhone(parsed.data);

    const cooldown = checkRateLimit(hashRateLimitKey("otp-send-cooldown", normalizedPhone), 1, 30 * 1000);
    if (!cooldown.allowed) return rateLimitResponse(cooldown.retryAfterMs);

    const phoneHourlyLimit = checkRateLimit(
      hashRateLimitKey("pwd-reset-send-phone", normalizedPhone),
      3,
      60 * 60 * 1000,
    );
    if (!phoneHourlyLimit.allowed) return rateLimitResponse(phoneHourlyLimit.retryAfterMs);

    const rateLimitKey = `pwd-reset-limit:${normalizedPhone}`;
    const nowMs = BigInt(Date.now());
    const windowMs = BigInt(24 * 60 * 60 * 1000);

    type PreCheckResult =
      | { status: "RATE_LIMITED"; retryAfterSeconds: number }
      | { status: "USER_INACTIVE_OR_ABSENT"; dummyToken: string }
      | { status: "ALLOWED"; resetToken: string };

    const preCheck: PreCheckResult = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${rateLimitKey}))`;

      const existingLimit = await tx.rateLimit.findUnique({
        where: { key: rateLimitKey },
      });

      if (existingLimit && nowMs - existingLimit.lastRequest < windowMs) {
        const retryAfterMs = Number(windowMs - (nowMs - existingLimit.lastRequest));
        const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
        return { status: "RATE_LIMITED", retryAfterSeconds } as const;
      }

      const user = await tx.user.findFirst({
        where: { phoneNumber: { in: [normalizedPhone, `+91${normalizedPhone}`] } },
        select: { id: true, status: true },
      });

      if (!user || user.status === "BANNED" || user.status === "DELETED") {
        const dummyToken = crypto.randomBytes(32).toString("hex");
        return { status: "USER_INACTIVE_OR_ABSENT", dummyToken } as const;
      }

      const resetToken = crypto.randomBytes(32).toString("hex");

      await tx.verification.deleteMany({
        where: { identifier: `pwd-reset-intent:${normalizedPhone}` },
      });

      await tx.verification.create({
        data: {
          identifier: `pwd-reset-intent:${normalizedPhone}`,
          value: JSON.stringify({
            resetToken,
            otpVerified: false,
            createdAt: Date.now(),
            lastSentAt: Date.now(),
          }),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      return { status: "ALLOWED", resetToken } as const;
    });

    if (preCheck.status === "RATE_LIMITED") {
      return Response.json(
        {
          error: "RATE_LIMIT_EXCEEDED",
          message: "You can only complete one password reset every 24 hours. Please try again later.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(preCheck.retryAfterSeconds) },
        },
      );
    }

    const resetToken =
      preCheck.status === "ALLOWED" ? preCheck.resetToken : preCheck.dummyToken;

    return Response.json({
      ok: true,
      message: "If an account is associated with this number, a verification code has been sent.",
      resetToken,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
