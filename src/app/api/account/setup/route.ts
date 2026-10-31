import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/auth";
import { requireActiveUser } from "@/lib/auth/guards";
import { setupCredentialsSchema } from "@/lib/validation/auth";
import { handleApiError } from "@/lib/api/handle-error";
import {
  checkRateLimit,
  hashRateLimitKey,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    const user = await requireActiveUser();

    const limit = checkRateLimit(
      hashRateLimitKey("account-setup", user.id),
      5,
      60 * 60 * 1000,
    );
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);

    const body = await request.json();
    const parsed = setupCredentialsSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Please enter valid account details.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { name, username, password } = parsed.data;

    if (!user.phoneNumberVerified) {
      return Response.json(
        {
          ok: false,
          error: "PHONE_VERIFICATION_REQUIRED",
          message: "Verify your phone number before completing your account.",
        },
        { status: 403 }
      );
    }

    if (user.username) {
      return Response.json(
        {
          ok: false,
          error: "ACCOUNT_ALREADY_SETUP",
          message: "Your account is already configured.",
        },
        { status: 409 }
      );
    }

    const normalizedUsername = username.toLowerCase();
    const existingUsername = await prisma.user.findFirst({
      where: { username: { equals: normalizedUsername, mode: "insensitive" } },
      select: { id: true },
    });

    if (existingUsername) {
      return Response.json(
        {
          ok: false,
          error: "USERNAME_TAKEN",
          message: "That username is already taken.",
        },
        { status: 409 }
      );
    }

    await auth.api.setPassword({
      body: { newPassword: password },
      headers: await headers(),
    });

    const claimed = await prisma.user.updateMany({
      where: { id: user.id, username: null },
      data: {
        name,
        username: normalizedUsername,
        displayUsername: username,
      },
    });
    if (claimed.count !== 1) {
      return Response.json(
        {
          ok: false,
          error: "ACCOUNT_ALREADY_SETUP",
          message: "A username has already been set for this account and cannot be changed.",
        },
        { status: 409 }
      );
    }

    return Response.json({
      ok: true,
      message: "Account created successfully.",
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return Response.json({
        ok: false,
        error: "USERNAME_TAKEN",
        message: "That username is already taken. Choose another one.",
      }, { status: 409 });
    }
    return handleApiError(error);
  }
}
