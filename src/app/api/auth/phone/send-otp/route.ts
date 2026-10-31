import { auth } from "@/lib/auth/auth";
import { takeDevelopmentOtp } from "@/lib/auth/sms";
import { handleApiError } from "@/lib/api/handle-error";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "ORIGIN_NOT_ALLOWED", message: "This verification request is not allowed." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { phoneNumber?: unknown } | null;
  const parsed = indianPhoneSchema.safeParse(body?.phoneNumber);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_PHONE_NUMBER", message: "Enter a valid 10-digit Indian mobile number." }, { status: 400 });
  }

  const phoneNumber = normalizeIndianPhone(parsed.data);
  const limit = checkRateLimit(hashRateLimitKey("signup-send-otp-phone", phoneNumber), 3, 60 * 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);

  try {
    await auth.api.sendPhoneNumberOTP({ body: { phoneNumber } });
    const developmentCode = process.env.NODE_ENV === "development" ? takeDevelopmentOtp(phoneNumber) : undefined;
    if (process.env.NODE_ENV === "development" && !developmentCode) {
      throw new Error("The local verification code could not be prepared.");
    }

    return Response.json({
      success: true,
      message: developmentCode ? "Local development code ready. It expires in 5 minutes." : "Verification code sent.",
      ...(developmentCode ? { developmentCode } : {}),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
