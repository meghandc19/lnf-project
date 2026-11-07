import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";
import { verifyWidgetAccessToken } from "@/lib/auth/sms";
import {
  checkRateLimit,
  hashRateLimitKey,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

const verifySchema = z.object({
  phoneNumber: indianPhoneSchema,
  accessToken: z.string().trim().min(1, "Access token is required."),
});

export async function POST(request: Request) {
  let user;
  try {
    user = await requireActiveUser();
  } catch (error) {
    return handleApiError(error);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const result = verifySchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "INVALID_VERIFICATION_REQUEST",
        message: "Enter a valid Indian mobile number and verification token.",
      },
      { status: 400 },
    );
  }

  const normalizedPhone = normalizeIndianPhone(result.data.phoneNumber);

  const phoneLimit = checkRateLimit(
    hashRateLimitKey("account-verify-otp-phone", normalizedPhone),
    5,
    15 * 60 * 1000,
  );
  if (!phoneLimit.allowed) return rateLimitResponse(phoneLimit.retryAfterMs);

  const userLimit = checkRateLimit(
    hashRateLimitKey("account-verify-otp-user", user.id),
    20,
    15 * 60 * 1000,
  );
  if (!userLimit.allowed) return rateLimitResponse(userLimit.retryAfterMs);

  try {
    const tokenHash = hashRateLimitKey("msg91-token", result.data.accessToken);
    const alreadyUsed = await prisma.rateLimit.findUnique({
      where: { key: `msg91-token:${tokenHash}` },
    });
    if (alreadyUsed) {
      return NextResponse.json(
        {
          error: "TOKEN_ALREADY_USED",
          message: "This verification token has already been consumed. Please request a new code.",
        },
        { status: 400 },
      );
    }

    const verification = await verifyWidgetAccessToken(result.data.accessToken);
    if (!verification.success || !verification.mobile) {
      return NextResponse.json(
        {
          error: "INVALID_OR_EXPIRED_TOKEN",
          message: verification.error ?? "Invalid or expired verification token. Please try again.",
        },
        { status: 400 },
      );
    }

    const tokenDigits = verification.mobile.replace(/\D/g, "");
    const expectedDigits = normalizedPhone.replace(/\D/g, "");
    if (!tokenDigits.endsWith(expectedDigits.slice(-10))) {
      return NextResponse.json(
        {
          error: "PHONE_MISMATCH",
          message: "The verified number does not match your submitted phone number.",
        },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      const linkedAccount = await tx.user.findFirst({
        where: {
          phoneNumber: { in: [normalizedPhone, `+91${normalizedPhone}`] },
          id: { not: user.id },
        },
        select: { id: true },
      });

      if (linkedAccount) {
        throw new Error("PHONE_NUMBER_IN_USE");
      }

      await tx.rateLimit.create({
        data: {
          key: `msg91-token:${tokenHash}`,
          count: 1,
          lastRequest: BigInt(Date.now()),
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          phoneNumber: normalizedPhone,
          phoneNumberVerified: true,
          phoneVerifiedAt: new Date(),
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Phone number verified successfully.",
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const target = (error as { meta?: { target?: string[] | string } }).meta?.target;
      const isTokenCollision = Array.isArray(target) ? target.includes("key") : target === "key";
      if (isTokenCollision) {
        return NextResponse.json(
          {
            error: "TOKEN_ALREADY_USED",
            message: "This verification token has already been consumed. Please request a new code.",
          },
          { status: 409 },
        );
      }
      return NextResponse.json(
        {
          error: "PHONE_NUMBER_IN_USE",
          message: "This number is already linked to another REVOK account.",
        },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message === "PHONE_NUMBER_IN_USE") {
      return NextResponse.json(
        {
          error: "PHONE_NUMBER_IN_USE",
          message: "This number is already linked to another REVOK account.",
        },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message.includes("unavailable")) {
      return NextResponse.json(
        { error: "OTP_PROVIDER_UNAVAILABLE", message: "Phone verification is temporarily unavailable. Please try again shortly." },
        { status: 503 },
      );
    }

    return handleApiError(error);
  }
}
