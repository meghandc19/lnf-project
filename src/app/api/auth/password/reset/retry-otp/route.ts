import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { retryWidgetOtpServer } from "@/lib/auth/sms";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { handleApiError } from "@/lib/api/handle-error";

const retryOtpSchema = z.object({
  phoneNumber: indianPhoneSchema,
  resetToken: z.string().min(16),
});

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return Response.json(
        { error: "ORIGIN_NOT_ALLOWED", message: "This request is not allowed." },
        { status: 403 }
      );
    }

    const ip = request.headers.get("x-forwarded-for") || "unknown-ip";
    const limit = checkRateLimit(hashRateLimitKey("pwd-reset-retry-ip", ip), 5, 15 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);

    const body = await request.json().catch(() => null);
    const parsed = retryOtpSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: "Invalid retry request." },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizeIndianPhone(parsed.data.phoneNumber);

    // Explicitly reject if this reset session has already been consumed / completed
    const alreadyConsumed = await prisma.rateLimit.findUnique({
      where: { key: `pwd-reset-consumed:${parsed.data.resetToken}` },
    });
    if (alreadyConsumed) {
      return Response.json(
        {
          error: "TOKEN_ALREADY_USED",
          message: "This password reset session has already been completed.",
        },
        { status: 400 }
      );
    }

    const intents = await prisma.verification.findMany({
      where: {
        identifier: `pwd-reset-intent:${normalizedPhone}`,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    let matchedIntent: {
      id: string;
      reqId: string;
      retriesCount: number;
      lastSentAt: number;
    } | null = null;

    for (const item of intents) {
      try {
        const data = JSON.parse(item.value) as {
          resetToken?: string;
          reqId?: string;
          pending?: boolean;
          retriesCount?: number;
          lastSentAt?: number;
        };
        if (data.resetToken === parsed.data.resetToken && !data.pending && data.reqId) {
          matchedIntent = {
            id: item.id,
            reqId: data.reqId,
            retriesCount: typeof data.retriesCount === "number" ? data.retriesCount : 0,
            lastSentAt: typeof data.lastSentAt === "number" ? data.lastSentAt : 0,
          };
          break;
        }
      } catch {
        // Ignored
      }
    }

    if (!matchedIntent) {
      return Response.json(
        {
          error: "INVALID_INTENT",
          message: "The reset session has expired or is invalid. Please start over.",
        },
        { status: 400 }
      );
    }

    // Enforce server-side attempt limits: max 2 retries per reset session
    const MAX_RETRIES = 2;
    if (matchedIntent.retriesCount >= MAX_RETRIES) {
      return Response.json(
        {
          error: "MAX_RETRIES_EXCEEDED",
          message: "Maximum verification code resends reached for this session.",
        },
        { status: 429 }
      );
    }

    // Enforce server-side cooldown: 30 seconds between sends/retries
    const COOLDOWN_MS = 30_000;
    const timeSinceLastSend = Date.now() - matchedIntent.lastSentAt;
    if (timeSinceLastSend < COOLDOWN_MS) {
      const remainingSeconds = Math.max(1, Math.ceil((COOLDOWN_MS - timeSinceLastSend) / 1000));
      return Response.json(
        {
          error: "COOLDOWN_ACTIVE",
          message: `Please wait ${remainingSeconds} seconds before requesting another code.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(remainingSeconds) },
        }
      );
    }

    // Call MSG91 Retry OTP API using the bound original reqId
    const retryResult = await retryWidgetOtpServer({ reqId: matchedIntent.reqId });
    if (!retryResult.success) {
      return Response.json(
        {
          error: "RETRY_FAILED",
          message: retryResult.error || "Failed to resend code. Please try again shortly.",
        },
        { status: 400 }
      );
    }

    // Update retry count and lastSentAt timestamp on the stored intent
    await prisma.verification.update({
      where: { id: matchedIntent.id },
      data: {
        value: JSON.stringify({
          resetToken: parsed.data.resetToken,
          reqId: matchedIntent.reqId,
          pending: false,
          retriesCount: matchedIntent.retriesCount + 1,
          lastSentAt: Date.now(),
        }),
      },
    });

    return Response.json({
      ok: true,
      message: "A new 4-digit verification code has been sent.",
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
