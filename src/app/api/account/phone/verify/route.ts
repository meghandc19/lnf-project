import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";
import {
  checkRateLimit,
  hashRateLimitKey,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

const verifySchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .regex(
      /^\+[1-9]\d{7,14}$/,
      "Invalid phone number.",
    ),

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
        error: "Invalid verification request.",
        details: result.error.flatten(),
      },
      { status: 400 },
    );
  }

  const phoneLimit = checkRateLimit(
    hashRateLimitKey("account-verify-otp-phone", result.data.phoneNumber),
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
    await auth.api.verifyPhoneNumber({
      headers: requestHeaders,

      body: {
        phoneNumber: result.data.phoneNumber,
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
        phoneNumber: result.data.phoneNumber,
        phoneNumberVerified: true,
        phoneVerifiedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Phone number verified successfully.",
    });
  } catch {
    console.error("VERIFY PHONE ERROR");

    return NextResponse.json(
      {
        error:
          "Invalid or expired OTP. Please request a new OTP.",
      },
      { status: 400 },
    );
  }
}
