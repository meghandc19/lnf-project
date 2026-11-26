import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "better-auth/crypto";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { handleApiError } from "@/lib/api/handle-error";

const resetPasswordConfirmSchema = z.object({
  phoneNumber: indianPhoneSchema,
  resetToken: z.string().min(16),
  newPassword: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return Response.json(
        { error: "ORIGIN_NOT_ALLOWED", message: "This password reset request is not allowed." },
        { status: 403 },
      );
    }

    const ip = request.headers.get("x-forwarded-for") || "unknown-ip";
    const limit = checkRateLimit(hashRateLimitKey("pwd-reset-confirm-ip", ip), 10, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);

    const body = await request.json().catch(() => null);
    const parsed = resetPasswordConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "Please enter valid password reset details.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { phoneNumber: rawPhone, resetToken, newPassword } = parsed.data;
    const normalizedPhone = normalizeIndianPhone(rawPhone);

    const tokenAlreadyUsed = await prisma.rateLimit.findUnique({
      where: { key: `pwd-reset-consumed:${resetToken}` },
    });
    if (tokenAlreadyUsed) {
      return Response.json(
        {
          error: "TOKEN_ALREADY_USED",
          message: "This password reset session has already been used. Please request a new code.",
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
          message: "The password reset request has expired or is invalid. Please request a new code.",
        },
        { status: 400 },
      );
    }

    if (!matchedIntent.otpVerified) {
      return Response.json(
        {
          error: "OTP_NOT_VERIFIED",
          message: "Please verify your 4-digit OTP before setting a new password.",
        },
        { status: 403 },
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

    const hashedPassword = await hashPassword(newPassword);
    const rateLimitKey = `pwd-reset-limit:${normalizedPhone}`;
    const nowMs = BigInt(Date.now());

    await prisma.$transaction(async (tx) => {
      const deletedIntent = await tx.verification.deleteMany({
        where: {
          identifier: `pwd-reset-intent:${normalizedPhone}`,
          id: matchedIntent.id,
        },
      });

      if (deletedIntent.count !== 1) {
        throw new Error("INTENT_ALREADY_CONSUMED");
      }

      await tx.rateLimit.create({
        data: {
          key: `pwd-reset-consumed:${resetToken}`,
          count: 1,
          lastRequest: nowMs,
        },
      });

      await tx.rateLimit.upsert({
        where: { key: rateLimitKey },
        create: { key: rateLimitKey, count: 1, lastRequest: nowMs },
        update: { count: { increment: 1 }, lastRequest: nowMs },
      });

      await tx.account.upsert({
        where: {
          providerId_accountId: {
            providerId: "credential",
            accountId: user.id,
          },
        },
        create: {
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: hashedPassword,
        },
        update: {
          password: hashedPassword,
        },
      });

      await tx.session.deleteMany({
        where: { userId: user.id },
      });
    });

    return Response.json({
      ok: true,
      message: "Password reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INTENT_ALREADY_CONSUMED") {
      return Response.json(
        {
          error: "TOKEN_ALREADY_USED",
          message: "This password reset request has already been used. Please request a new code.",
        },
        { status: 409 },
      );
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return Response.json(
        {
          error: "TOKEN_ALREADY_USED",
          message: "This password reset session has already been used. Please request a new code.",
        },
        { status: 409 },
      );
    }
    return handleApiError(error);
  }
}
