import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { requirePhoneVerified } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";

const bodySchema = z.object({ newPassword: z.string().min(8).max(128) }).strict();

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This password request is not allowed." }, { status: 403 });
    const user = await requirePhoneVerified();
    const limit = checkRateLimit(hashRateLimitKey("account-password-set", user.id), 3, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ message: "Choose a password between 8 and 128 characters." }, { status: 400 });

    const credential = await prisma.account.findFirst({ where: { userId: user.id, providerId: "credential" }, select: { password: true } });
    if (credential?.password) return Response.json({ message: "A password is already set. Use the change-password form instead." }, { status: 409 });

    await auth.api.setPassword({ body: { newPassword: parsed.data.newPassword }, headers: await headers() });
    return Response.json({ ok: true, message: "Password added to your REVOK account." });
  } catch (error) {
    return handleApiError(error);
  }
}
