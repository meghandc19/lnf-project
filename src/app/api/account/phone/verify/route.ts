import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

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

  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
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
        id: session.user.id,
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
  } catch (error) {
    console.error("VERIFY PHONE ERROR:", error);

    return NextResponse.json(
      {
        error:
          "Invalid or expired OTP. Please request a new OTP.",
      },
      { status: 400 },
    );
  }
}