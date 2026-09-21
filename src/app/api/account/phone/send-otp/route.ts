import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth/auth";

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
  const session = await auth.api.getSession({
    headers: await headers(),
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

  if (
    session.user.phoneNumber === phoneNumber &&
    session.user.phoneNumberVerified
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
  } catch (error) {
    console.error("SEND PHONE OTP ERROR:", error);

    return NextResponse.json(
      { error: "Unable to send OTP." },
      { status: 500 },
    );
  }
}