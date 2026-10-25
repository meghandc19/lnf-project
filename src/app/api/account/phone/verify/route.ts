import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";
import {
  checkRateLimit,
  hashRateLimitKey,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

const verifySchema = z.object({
  phoneNumber: indianPhoneSchema,

  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "OTP must be 6 digits."),
});

export async function POST(request: Request) {
  const requestHeaders = await headers();

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
        message: "Enter a valid 10-digit Indian number and the six-digit OTP.",
      },
      { status: 400 },
    );
  }

  const phoneLimit = checkRateLimit(
    hashRateLimitKey("account-verify-otp-phone", normalizeIndianPhone(result.data.phoneNumber)),
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
    const phoneNumber = normalizeIndianPhone(result.data.phoneNumber);
    const linkedAccount = await prisma.user.findFirst({
      where: {
        phoneNumber: { in: [phoneNumber, `+91${phoneNumber}`] },
        id: { not: user.id },
      },
      select: { id: true },
    });
    if (linkedAccount) {
      return NextResponse.json(
        {
          error: "PHONE_NUMBER_IN_USE",
          message: "This number is already linked to another REVOK account. Sign in to that existing account with its phone and password, or use the Google account already connected to it. A phone number can’t be linked to two accounts.",
        },
        { status: 409 },
      );
    }

    await auth.api.verifyPhoneNumber({
      headers: requestHeaders,

      body: {
        phoneNumber,
        code: result.data.code,
        updatePhoneNumber: true,
        disableSession: false,
      },
    });

    await prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        phoneNumber,
        phoneNumberVerified: true,
        phoneVerifiedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Phone number verified successfully.",
    });
  } catch (error) {
    console.error("VERIFY PHONE ERROR", { name: error instanceof Error ? error.name : "UnknownError" });

    return NextResponse.json(
      {
        error: "INVALID_OR_EXPIRED_OTP",
        message: "Invalid or expired OTP. Please request a new code and enter the same phone number used to receive it.",
      },
      { status: 400 },
    );
  }
}
