import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";
import { sendWidgetOtpServer } from "@/lib/auth/sms";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { handleApiError } from "@/lib/api/handle-error";

async function rollbackReservation(params: {
  rateLimitKey: string;
  previousLastRequest: bigint;
  reservationNowMs: bigint;
  normalizedPhone: string;
  resetToken: string;
}) {
  try {
    // Only rollback rate-limit if the lastRequest field is still the exact timestamp written by this request.
    // If another request concurrently reserved a newer timestamp, this matches 0 rows and preserves the newer reservation.
    if (params.previousLastRequest === BigInt(0)) {
      await prisma.rateLimit.deleteMany({
        where: {
          key: params.rateLimitKey,
          lastRequest: params.reservationNowMs,
        },
      });
    } else {
      await prisma.rateLimit.updateMany({
        where: {
          key: params.rateLimitKey,
          lastRequest: params.reservationNowMs,
        },
        data: {
          lastRequest: params.previousLastRequest,
        },
      });
    }

    // Only delete the EXACT pending reset intent created by this failed request, matching both phone and resetToken.
    // Never deletes a newer intent or any other intent.
    await prisma.verification.deleteMany({
      where: {
        identifier: `pwd-reset-intent:${params.normalizedPhone}`,
        value: { contains: params.resetToken },
      },
    });
  } catch (err) {
    console.error("Failed to rollback rate limit reservation:", err);
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return Response.json(
        { error: "ORIGIN_NOT_ALLOWED", message: "This password reset request is not allowed." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as { phoneNumber?: unknown } | null;
    const parsed = indianPhoneSchema.safeParse(body?.phoneNumber);
    if (!parsed.success) {
      return Response.json(
        { error: "INVALID_PHONE_NUMBER", message: "Enter a valid 10-digit Indian mobile number." },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizeIndianPhone(parsed.data);
    const rateLimitKey = `pwd-reset-limit:${normalizedPhone}`;
    const nowMs = BigInt(Date.now());
    const windowMs = BigInt(24 * 60 * 60 * 1000);

    type PreReservationResult =
      | { status: "RATE_LIMITED"; retryAfterSeconds: number }
      | { status: "USER_INACTIVE_OR_ABSENT"; dummyToken: string }
      | { status: "ALLOWED"; resetToken: string; previousLastRequest: bigint };

    // Step 1: Concurrency-safe check & reservation under PostgreSQL advisory lock in a quick transaction.
    // Database connection is NOT held open while awaiting MSG91 external HTTP API.
    const reservation: PreReservationResult = await prisma.$transaction(async (tx) => {
      // 1. Transaction-level advisory lock (held only for the duration of this fast DB transaction)
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${rateLimitKey}))`;

      // 2. Check 24-hour rate limit under the lock
      const existingLimit = await tx.rateLimit.findUnique({
        where: { key: rateLimitKey },
      });

      if (existingLimit && nowMs - existingLimit.lastRequest < windowMs) {
        const retryAfterMs = Number(windowMs - (nowMs - existingLimit.lastRequest));
        const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
        return { status: "RATE_LIMITED", retryAfterSeconds } as const;
      }

      // 3. User lookup
      const user = await tx.user.findFirst({
        where: { phoneNumber: normalizedPhone },
        select: { id: true, status: true },
      });

      // 4. Anti-enumeration protection:
      // If user does not exist or is banned/deleted, record rate-limit to prevent enumeration probing
      if (!user || user.status === "BANNED" || user.status === "DELETED") {
        await tx.rateLimit.upsert({
          where: { key: rateLimitKey },
          create: { key: rateLimitKey, count: 1, lastRequest: nowMs },
          update: { count: { increment: 1 }, lastRequest: nowMs },
        });
        const dummyToken = crypto.randomBytes(32).toString("hex");
        return { status: "USER_INACTIVE_OR_ABSENT", dummyToken } as const;
      }

      // 5. Active user exists: reserve rate-limit slot with current timestamp
      const prevTime = existingLimit?.lastRequest ?? BigInt(0);
      await tx.rateLimit.upsert({
        where: { key: rateLimitKey },
        create: { key: rateLimitKey, count: 1, lastRequest: nowMs },
        update: { count: { increment: 1 }, lastRequest: nowMs },
      });

      const resetToken = crypto.randomBytes(32).toString("hex");

      // Pre-create pending verification record
      await tx.verification.deleteMany({
        where: { identifier: `pwd-reset-intent:${normalizedPhone}` },
      });

      await tx.verification.create({
        data: {
          identifier: `pwd-reset-intent:${normalizedPhone}`,
          value: JSON.stringify({
            resetToken,
            reqId: null,
            pending: true,
            retriesCount: 0,
            lastSentAt: Date.now(),
          }),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      return {
        status: "ALLOWED",
        resetToken,
        previousLastRequest: prevTime,
      } as const;
    });

    if (reservation.status === "RATE_LIMITED") {
      return Response.json(
        {
          error: "RATE_LIMIT_EXCEEDED",
          message: "You can only request one password reset code every 24 hours. Please try again later.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(reservation.retryAfterSeconds) },
        }
      );
    }

    if (reservation.status === "USER_INACTIVE_OR_ABSENT") {
      return Response.json({
        ok: true,
        message: "If an account is associated with this number, a verification code has been sent.",
        resetToken: reservation.dummyToken,
      });
    }

    // Step 2: Trigger server-side OTP dispatch via MSG91 (OUTSIDE any database transaction!)
    let sendResult: { success: boolean; reqId?: string; error?: string };
    try {
      sendResult = await sendWidgetOtpServer({ phoneNumber: normalizedPhone });
    } catch (providerError) {
      // Provider network error / timeout / unconfigured: safely rollback reservation & delete exact pending intent
      await rollbackReservation({
        rateLimitKey,
        previousLastRequest: reservation.previousLastRequest,
        reservationNowMs: nowMs,
        normalizedPhone,
        resetToken: reservation.resetToken,
      });
      throw providerError;
    }

    if (!sendResult.success || !sendResult.reqId) {
      // Provider returned non-success response: safely rollback reservation & delete exact pending intent
      await rollbackReservation({
        rateLimitKey,
        previousLastRequest: reservation.previousLastRequest,
        reservationNowMs: nowMs,
        normalizedPhone,
        resetToken: reservation.resetToken,
      });
      return Response.json(
        {
          error: "OTP_DELIVERY_FAILED",
          message: sendResult.error || "Failed to send verification code. Please try again.",
        },
        { status: 400 }
      );
    }

    // Step 3: Activate intent in database with confirmed reqId
    try {
      const updated = await prisma.verification.updateMany({
        where: {
          identifier: `pwd-reset-intent:${normalizedPhone}`,
          value: { contains: reservation.resetToken },
        },
        data: {
          value: JSON.stringify({
            resetToken: reservation.resetToken,
            reqId: sendResult.reqId,
            pending: false,
            retriesCount: 0,
            lastSentAt: Date.now(),
          }),
        },
      });

      if (updated.count !== 1) {
        throw new Error("RESET_INTENT_ACTIVATION_FAILED");
      }
    } catch (dbError) {
      // If DB update fails after SMS dispatch, rollback reservation so user is not locked out for 24 hours
      await rollbackReservation({
        rateLimitKey,
        previousLastRequest: reservation.previousLastRequest,
        reservationNowMs: nowMs,
        normalizedPhone,
        resetToken: reservation.resetToken,
      });
      throw dbError;
    }

    return Response.json({
      ok: true,
      message: "If an account is associated with this number, a verification code has been sent.",
      resetToken: reservation.resetToken,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("unavailable")) {
      return Response.json(
        {
          error: "OTP_PROVIDER_UNAVAILABLE",
          message: "The SMS verification service is temporarily unavailable. Please try again shortly.",
        },
        { status: 503 }
      );
    }
    return handleApiError(error);
  }
}
