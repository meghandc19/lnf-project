import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/auth";
import { requireLogin } from "@/lib/auth/guards";
import { setupCredentialsSchema } from "@/lib/validation/auth";
import { handleApiError } from "@/lib/api/handle-error";

export async function POST(request: Request) {
  try {
    const user = await requireLogin();

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

    const existingUsername = await prisma.user.findUnique({
      where: { username },
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
      body: {
        newPassword: password,
      },
      headers: await headers(),
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        username,
      },
    });

    return Response.json({
      ok: true,
      message: "Account created successfully.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}