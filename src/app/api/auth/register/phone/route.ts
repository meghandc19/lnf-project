import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyWidgetAccessToken } from "@/lib/auth/sms";
import { hashPassword } from "better-auth/crypto";
import { indianPhoneSchema, normalizeIndianPhone, usernameSchema } from "@/lib/validation/common";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { handleApiError } from "@/lib/api/handle-error";

const phoneRegistrationSchema = z.object({
  phoneNumber: indianPhoneSchema,
  accessToken: z.string().min(10),
  name: z.string().trim().min(2).max(100),
  username: usernameSchema,
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return Response.json(
        { error: "ORIGIN_NOT_ALLOWED", message: "This registration request is not allowed." },
        { status: 403 }
      );
    }

    const ip = request.headers.get("x-forwarded-for") || "unknown-ip";
    const limit = checkRateLimit(hashRateLimitKey("phone-registration-ip", ip), 10, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);

    const body = await request.json().catch(() => null);
    const parsed = phoneRegistrationSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "Please enter valid registration details.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { phoneNumber: rawPhone, accessToken, name, username, password } = parsed.data;
    const normalizedPhone = normalizeIndianPhone(rawPhone);
    const normalizedUsername = username.toLowerCase();

    // 1. Check if this token was already consumed anywhere in REVOK (RateLimit key @unique)
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
        { status: 400 }
      );
    }

    // 2. Verify MSG91 Widget Access Token server-side
    const tokenResult = await verifyWidgetAccessToken(accessToken);
    if (!tokenResult.success || !tokenResult.mobile) {
      return Response.json(
        {
          error: "INVALID_TOKEN",
          message: tokenResult.error || "Phone verification failed or expired. Please verify again.",
        },
        { status: 400 }
      );
    }

    const tokenDigits = tokenResult.mobile.replace(/\D/g, "");
    const expectedDigits = normalizedPhone.replace(/\D/g, "");
    if (!tokenDigits.endsWith(expectedDigits.slice(-10))) {
      return Response.json(
        {
          error: "PHONE_MISMATCH",
          message: "The verified phone number does not match the phone number provided.",
        },
        { status: 400 }
      );
    }

    // 2. Uniqueness checks
    const existingPhoneUser = await prisma.user.findFirst({
      where: { phoneNumber: normalizedPhone },
      select: { id: true },
    });
    if (existingPhoneUser) {
      return Response.json(
        {
          error: "PHONE_ALREADY_REGISTERED",
          message: "An account with this phone number already exists. Please log in.",
        },
        { status: 409 }
      );
    }

    const existingUsernameUser = await prisma.user.findFirst({
      where: { username: { equals: normalizedUsername, mode: "insensitive" } },
      select: { id: true },
    });
    if (existingUsernameUser) {
      return Response.json(
        {
          error: "USERNAME_TAKEN",
          message: "That username is already taken. Please choose another.",
        },
        { status: 409 }
      );
    }

    // 3. Hash password with Better Auth crypto
    const hashedPassword = await hashPassword(password);
    const digitsOnly = normalizedPhone.replace(/\D/g, "");
    const tempEmail = `${digitsOnly}@phone.lnf.local`;

    // 4. Create User and Credential Account in transaction
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: tempEmail,
          emailVerified: false,
          username: normalizedUsername,
          displayUsername: username,
          phoneNumber: normalizedPhone,
          phoneNumberVerified: true,
          phoneVerifiedAt: new Date(),
          role: "USER",
          status: "ACTIVE",
        },
      });

      await tx.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: hashedPassword,
        },
      });

      // Mark this token as consumed in unique RateLimit table (P2002 if racing)
      await tx.rateLimit.create({
        data: {
          key: `msg91-token:${tokenHash}`,
          count: 1,
          lastRequest: BigInt(Date.now()),
        },
      });
    });

    return Response.json({
      ok: true,
      message: "Account created successfully.",
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const target = (error as { meta?: { target?: string[] | string } }).meta?.target;
      const isTokenCollision = Array.isArray(target) ? target.includes("key") : target === "key";
      if (isTokenCollision) {
        return Response.json(
          {
            error: "TOKEN_ALREADY_USED",
            message: "This verification token has already been consumed. Please verify again.",
          },
          { status: 409 }
        );
      }
      return Response.json(
        {
          error: "DUPLICATE_ENTRY",
          message: "An account with this phone number or username already exists.",
        },
        { status: 409 }
      );
    }
    return handleApiError(error);
  }
}
