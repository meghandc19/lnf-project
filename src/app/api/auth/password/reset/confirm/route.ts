import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyWidgetOtpServer } from "@/lib/auth/sms";
import { hashPassword } from "better-auth/crypto";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { handleApiError } from "@/lib/api/handle-error";

const resetPasswordConfirmSchema = z.object({
  phoneNumber: indianPhoneSchema,
  resetToken: z.string().min(16),
  otp: z.string().regex(/^\d{4}$/, "Enter a valid 4-digit code."),
  newPassword: z.string().min(4).max(8),
});

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return Response.json(
        { error: "ORIGIN_NOT_ALLOWED", message: "This password reset request is not allowed." },
        { status: 403 }
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
        { status: 400 }
      );
    }

    const { phoneNumber: rawPhone, resetToken, otp, newPassword } = parsed.data;
    const normalizedPhone = normalizeIndianPhone(rawPhone);

    // 1. Check if this reset token has already been consumed
    const tokenAlreadyUsed = await prisma.rateLimit.findUnique({
      where: { key: `pwd-reset-consumed:${resetToken}` },
    });
    if (tokenAlreadyUsed) {
      return Response.json(
        {
          error: "TOKEN_ALREADY_USED",
          message: "This password reset session has already been used. Please request a new code.",
        },
        { status: 400 }
      );
    }

    // 2. Locate unexpired reset intent for this phone number
    const intents = await prisma.verification.findMany({
      where: {
        identifier: `pwd-reset-intent:${normalizedPhone}`,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    let matchedIntent: { id: string; reqId: string } | null = null;
    for (const item of intents) {
      try {
        const data = JSON.parse(item.value) as {
          resetToken?: string;
          reqId?: string;
          pending?: boolean;
        };
        if (data.resetToken === resetToken && !data.pending && typeof data.reqId === "string" && data.reqId.trim().length > 0) {
          matchedIntent = { id: item.id, reqId: data.reqId.trim() };
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
        { status: 400 }
      );
    }

    // 3. Verify OTP directly with MSG91 server using the bound reqId
    const verifyResult = await verifyWidgetOtpServer({
      otp,
      reqId: matchedIntent.reqId,
    });

    if (!verifyResult.success) {
      return Response.json(
        {
          error: "INVALID_OTP",
          message: verifyResult.error || "Invalid or expired verification code.",
        },
        { status: 400 }
      );
    }

    // 4. Locate active user
    const user = await prisma.user.findFirst({
      where: { phoneNumber: normalizedPhone },
      select: { id: true, status: true },
    });

    if (!user || user.status === "BANNED" || user.status === "DELETED") {
      return Response.json(
        {
          error: "ACCOUNT_UNAVAILABLE",
          message: "This account cannot be reset.",
        },
        { status: 403 }
      );
    }

    // 5. Hash new password using Better Auth crypto
    const hashedPassword = await hashPassword(newPassword);

    // 6. Atomically consume intent, record in unique RateLimit table, update credentials, and invalidate sessions
    await prisma.$transaction(async (tx) => {
      // Concurrency-safe intent check & atomic consumption
      const deletedIntent = await tx.verification.deleteMany({
        where: {
          identifier: `pwd-reset-intent:${normalizedPhone}`,
          id: matchedIntent.id,
        },
      });

      if (deletedIntent.count !== 1) {
        throw new Error("INTENT_ALREADY_CONSUMED");
      }

      // Mark this reset token as consumed in unique RateLimit table (P2002 if racing)
      await tx.rateLimit.create({
        data: {
          key: `pwd-reset-consumed:${resetToken}`,
          count: 1,
          lastRequest: BigInt(Date.now()),
        },
      });

      // Update Account credentials
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

      // Invalidate all existing sessions after password reset
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
        { status: 409 }
      );
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return Response.json(
        {
          error: "TOKEN_ALREADY_USED",
          message: "This password reset session has already been used. Please request a new code.",
        },
        { status: 409 }
      );
    }
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
