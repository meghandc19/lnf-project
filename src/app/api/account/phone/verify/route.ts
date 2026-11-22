import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";
import { verifyWidgetOtpServer } from "@/lib/auth/sms";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import {
  checkRateLimit,
  hashRateLimitKey,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

const verifySchema = z.object({
  phoneNumber: indianPhoneSchema,
  code: z.string().regex(/^\d{4}$/, "Enter the 4-digit verification code."),
});
type PhoneVerificationIntent = { phoneNumber?: string; reqId?: string; attempts?: number };

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "ORIGIN_NOT_ALLOWED", message: "This verification request is not allowed." }, { status: 403 });
  }
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
        message: "Enter a valid Indian mobile number and 4-digit verification code.",
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
    const identifier = `account-phone-verify:${user.id}`;
    const intent = await prisma.verification.findFirst({
      where: { identifier, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    let intentData: PhoneVerificationIntent | null = null;
    try {
      intentData = intent ? JSON.parse(intent.value) as PhoneVerificationIntent : null;
    } catch {
      intentData = null;
    }
    if (!intent || !intentData?.reqId || intentData.phoneNumber !== normalizedPhone) {
      return NextResponse.json(
        {
          error: "VERIFICATION_EXPIRED",
          message: "This verification request has expired. Please request a new code.",
        },
        { status: 400 },
      );
    }

    const attempts = typeof intentData.attempts === "number" ? intentData.attempts : 0;
    if (attempts >= 3) {
      return NextResponse.json(
        {
          error: "MAX_ATTEMPTS_EXCEEDED",
          message: "Too many incorrect codes. Request a new verification code and try again.",
        },
        { status: 429 },
      );
    }

    let verifyResult: Awaited<ReturnType<typeof verifyWidgetOtpServer>>;
    try {
      verifyResult = await verifyWidgetOtpServer({ otp: result.data.code, reqId: intentData.reqId });
    } catch {
      return NextResponse.json(
        { error: "OTP_PROVIDER_UNAVAILABLE", message: "The SMS verification service is temporarily unavailable. Please try again shortly." },
        { status: 503 },
      );
    }
    if (!verifyResult.success) {
      await prisma.verification.update({
        where: { id: intent.id },
        data: { value: JSON.stringify({ ...intentData, attempts: attempts + 1 }) },
      });
      return NextResponse.json(
        {
          error: "INVALID_OTP",
          message: verifyResult.error || "That code is incorrect or expired. Check it and try again.",
        },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      const consumed = await tx.verification.deleteMany({ where: { id: intent.id, identifier } });
      if (consumed.count !== 1) throw new Error("PHONE_VERIFICATION_ALREADY_USED");

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
    if (error instanceof Error && error.message === "PHONE_VERIFICATION_ALREADY_USED") {
      return NextResponse.json({ error: "VERIFICATION_ALREADY_USED", message: "This code has already been used. Request a new code." }, { status: 409 });
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
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
