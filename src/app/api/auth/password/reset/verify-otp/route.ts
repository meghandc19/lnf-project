import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyWidgetAccessToken } from "@/lib/auth/sms";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { handleApiError } from "@/lib/api/handle-error";

const verifyResetOtpSchema = z.object({
  phoneNumber: indianPhoneSchema,
  resetToken: z.string().min(16),
  accessToken: z.string().min(10),
});

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return Response.json(
        { error: "ORIGIN_NOT_ALLOWED", message: "This verification request is not allowed." },
        { status: 403 },
      );
    }

    const ip = request.headers.get("x-forwarded-for") || "unknown-ip";
    const ipLimit = checkRateLimit(hashRateLimitKey("pwd-reset-verify-ip", ip), 15, 15 * 60 * 1000);
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterMs);

    const body = await request.json().catch(() => null);
    const parsed = verifyResetOtpSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "Enter a valid phone number and verification token.",
        },
        { status: 400 },
      );
    }

    const { phoneNumber: rawPhone, resetToken, accessToken } = parsed.data;
    const normalizedPhone = normalizeIndianPhone(rawPhone);

    const phoneLimit = checkRateLimit(
      hashRateLimitKey("pwd-reset-verify-phone", normalizedPhone),
      5,
      15 * 60 * 1000,
    );
    if (!phoneLimit.allowed) return rateLimitResponse(phoneLimit.retryAfterMs);

    const consumedReset = await prisma.rateLimit.findUnique({
      where: { key: `pwd-reset-consumed:${resetToken}` },
    });
    if (consumedReset) {
      return Response.json(
        {
          error: "TOKEN_ALREADY_USED",
          message: "This password reset session has already been used. Please start over.",
        },
        { status: 400 },
      );
    }

    const tokenHash = hashRateLimitKey("msg91-token", accessToken);
    const tokenAlreadyUsed = await prisma.rateLimit.findUnique({
      where: { key: `msg91-token:${tokenHash}` },
    });
    if (tokenAlreadyUsed) {
      return Response.json(
        {
          error: "TOKEN_ALREADY_USED",
          message: "This verification token has already been consumed. Please verify again.",
        },
        { status: 400 },
      );
    }

    const tokenResult = await verifyWidgetAccessToken(accessToken);
    if (!tokenResult.success || !tokenResult.mobile) {
      return Response.json(
        {
          error: "INVALID_TOKEN",
          message: tokenResult.error || "Phone verification failed or expired. Please verify again.",
        },
        { status: 400 },
      );
    }

    const tokenDigits = tokenResult.mobile.replace(/\D/g, "");
    const expectedDigits = normalizedPhone.replace(/\D/g, "");
    if (!tokenDigits.endsWith(expectedDigits.slice(-10))) {
      return Response.json(
        {
          error: "PHONE_MISMATCH",
          message: "The verified phone number does not match the submitted phone number.",
        },
        { status: 400 },
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

    let matchedIntent: { id: string; otpVerified: boolean } | null = null;
    for (const item of intents) {
      try {
        const data = JSON.parse(item.value) as {
          resetToken?: string;
          otpVerified?: boolean;
        };
        if (data.resetToken === resetToken) {
          matchedIntent = { id: item.id, otpVerified: data.otpVerified === true };
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
          message: "No active password reset session was found for this number. Please check your number or create an account.",
        },
        { status: 400 },
      );
    }

    const user = await prisma.user.findFirst({
      where: { phoneNumber: { in: [normalizedPhone, `+91${normalizedPhone}`] } },
      select: { id: true, status: true },
    });
    if (!user || user.status === "BANNED" || user.status === "DELETED") {
      return Response.json(
        {
          error: "ACCOUNT_UNAVAILABLE",
          message: "This account cannot be reset.",
        },
        { status: 403 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.rateLimit.create({
        data: {
          key: `msg91-token:${tokenHash}`,
          count: 1,
          lastRequest: BigInt(Date.now()),
        },
      });

      const updated = await tx.verification.updateMany({
        where: {
          id: matchedIntent.id,
          identifier: `pwd-reset-intent:${normalizedPhone}`,
        },
        data: {
          value: JSON.stringify({
            resetToken,
            otpVerified: true,
            verifiedAt: Date.now(),
          }),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });
      if (updated.count !== 1) {
        throw new Error("INVALID_INTENT");
      }
    });

    return Response.json({
      ok: true,
      message: "Phone verified. Choose your new password.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_INTENT") {
      return Response.json(
        {
          error: "INVALID_INTENT",
          message: "The password reset request has expired or is invalid. Please start over.",
        },
        { status: 400 },
      );
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return Response.json(
        {
          error: "TOKEN_ALREADY_USED",
          message: "This verification token has already been consumed. Please verify again.",
        },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message.includes("unavailable")) {
      return Response.json(
        {
          error: "OTP_PROVIDER_UNAVAILABLE",
          message: "The SMS verification service is temporarily unavailable. Please try again shortly.",
        },
        { status: 503 },
      );
    }
    return handleApiError(error);
  }
}
