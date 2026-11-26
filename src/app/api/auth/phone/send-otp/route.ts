import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "ORIGIN_NOT_ALLOWED", message: "This verification request is not allowed." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { phoneNumber?: unknown } | null;
  const parsed = indianPhoneSchema.safeParse(body?.phoneNumber);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_PHONE_NUMBER", message: "Enter a valid 10-digit Indian mobile number." }, { status: 400 });
  }

  const phoneNumber = normalizeIndianPhone(parsed.data);
  const cooldown = checkRateLimit(hashRateLimitKey("otp-send-cooldown", phoneNumber), 1, 30 * 1000);
  if (!cooldown.allowed) return rateLimitResponse(cooldown.retryAfterMs);
  const limit = checkRateLimit(hashRateLimitKey("signup-send-otp-phone", phoneNumber), 3, 60 * 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);

  const existing = await prisma.user.findFirst({
    where: { phoneNumber },
    select: { id: true },
  });
  if (existing) {
    return Response.json(
      {
        error: "PHONE_ALREADY_REGISTERED",
        message: "This phone number is already registered. Please log in instead.",
      },
      { status: 409 }
    );
  }

  return Response.json({ success: true, message: "Phone validated." });
}
