import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth/auth";
import { requireActiveUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";
import { handleApiError } from "@/lib/api/handle-error";
import {
  checkRateLimit,
  hashRateLimitKey,
  rateLimitResponse,
} from "@/lib/security/rate-limit";
import { takeDevelopmentOtp } from "@/lib/auth/sms";

const phoneSchema = z.object({ phoneNumber: indianPhoneSchema });

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
        error: "INVALID_PHONE_NUMBER",
        message: "Enter a valid 10-digit Indian mobile number.",
      },
      { status: 400 },
    );
  }

  // Match the national-format value used by Better Auth's phone signup and login.
  const phoneNumber = normalizeIndianPhone(result.data.phoneNumber);

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

  const phoneVariants = [phoneNumber, `+91${phoneNumber}`];
  if (user.phoneNumberVerified && phoneVariants.includes(user.phoneNumber ?? "")) {
    return NextResponse.json(
      { error: "PHONE_ALREADY_VERIFIED", message: "This phone number is already verified on your account. Continue to REVOK." },
      { status: 400 },
    );
  }

  let linkedAccount;
  try {
    linkedAccount = await prisma.user.findFirst({
      where: { phoneNumber: { in: phoneVariants }, id: { not: user.id } },
      select: { id: true },
    });
  } catch (error) {
    return handleApiError(error);
  }
  if (linkedAccount) {
    return NextResponse.json(
      {
        error: "PHONE_NUMBER_IN_USE",
        message: "This number is already linked to another REVOK account. Sign in to that existing account with its phone and password, or use the Google account already connected to it. A phone number can’t be linked to two accounts.",
      },
      { status: 409 },
    );
  }

  try {
    await auth.api.sendPhoneNumberOTP({
      body: {
        phoneNumber,
      },
    });

    const developmentCode = process.env.NODE_ENV === "development" ? takeDevelopmentOtp(phoneNumber) : undefined;
    if (process.env.NODE_ENV === "development" && !developmentCode) {
      throw new Error("The local verification code could not be prepared.");
    }

    return NextResponse.json({
      success: true,
      message: developmentCode ? "Local development code ready. It expires in 5 minutes." : "Verification code sent.",
      ...(developmentCode ? { developmentCode } : {}),
    });
  } catch (error) {
    console.error("SEND PHONE OTP ERROR", { name: error instanceof Error ? error.name : "UnknownError" });

    return NextResponse.json(
      { error: "OTP_DELIVERY_FAILED", message: "The verification code could not be delivered. Check the SMS provider configuration and try again." },
      { status: 500 },
    );
  }
}
