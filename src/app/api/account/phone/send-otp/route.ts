import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth/auth";
import { requireActiveUser } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";
import {
  checkRateLimit,
  hashRateLimitKey,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

const phoneSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .regex(
      /^\+[1-9]\d{7,14}$/,
      "Use international format, for example +919876543210.",
    ),
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

  const result = phoneSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Invalid phone number.",
        details: result.error.flatten(),
      },
      { status: 400 },
    );
  }

  const phoneNumber = result.data.phoneNumber;

  const phoneLimit = checkRateLimit(
    hashRateLimitKey("account-send-otp-phone", phoneNumber),
    3,
    60 * 60 * 1000,
  );
  if (!phoneLimit.allowed) return rateLimitResponse(phoneLimit.retryAfterMs);

  const userLimit = checkRateLimit(
    hashRateLimitKey("account-send-otp-user", user.id),
    5,
    60 * 60 * 1000,
  );
  if (!userLimit.allowed) return rateLimitResponse(userLimit.retryAfterMs);

  if (
    user.phoneNumber === phoneNumber &&
    user.phoneNumberVerified
  ) {
    return NextResponse.json(
      { error: "This phone number is already verified." },
      { status: 400 },
    );
  }

  try {
    await auth.api.sendPhoneNumberOTP({
      body: {
        phoneNumber,
      },
    });

    return NextResponse.json({
      success: true,
      message: "OTP sent.",
    });
  } catch {
    console.error("SEND PHONE OTP ERROR");

    return NextResponse.json(
      { error: "Unable to send OTP." },
      { status: 500 },
    );
  }
}
