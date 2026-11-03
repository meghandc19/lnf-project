import { auth } from "@/lib/auth/auth";
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
  const cooldown = checkRateLimit(hashRateLimitKey("otp-send-cooldown", phoneNumber), 1, 60 * 1000);
  if (!cooldown.allowed) return rateLimitResponse(cooldown.retryAfterMs);
  const limit = checkRateLimit(hashRateLimitKey("signup-send-otp-phone", phoneNumber), 3, 60 * 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);

  try {
    await auth.api.sendPhoneNumberOTP({ body: { phoneNumber } });
    return Response.json({ success: true, message: "Verification code sent." });
  } catch {
    return Response.json({ error: "OTP_DELIVERY_FAILED", message: "The verification code could not be sent. Check the number and try again later." }, { status: 503 });
  }
}
