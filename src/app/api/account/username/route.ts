import { z } from "zod";
import { getAuthenticatedUser, requireActiveUser } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";
import { prisma } from "@/lib/prisma";
import { usernameSchema } from "@/lib/validation/common";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { isSameOriginRequest } from "@/lib/security/same-origin";

const bodySchema = z.object({ username: usernameSchema }).strict();

async function checkAvailability(username: string) {
  return prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true },
  });
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-ip";
    const limitKey = user?.id
      ? hashRateLimitKey("username-availability", user.id)
      : hashRateLimitKey("username-availability-ip", ip);

    const limit = checkRateLimit(limitKey, 40, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);

    const parsed = usernameSchema.safeParse(new URL(request.url).searchParams.get("username")?.trim());
    if (!parsed.success) return Response.json({ available: false, message: "Use 3–8 letters, numbers, underscores, or @." }, { status: 400 });

    if (user?.username) return Response.json({ available: false, locked: true, message: "Your username has already been set and cannot be changed." });

    const existing = await checkAvailability(parsed.data.toLowerCase());
    return Response.json({ available: !existing });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return Response.json({ error: "ORIGIN_NOT_ALLOWED", message: "This username request is not allowed." }, { status: 403 });
    }
    const user = await requireActiveUser();
    const limit = checkRateLimit(hashRateLimitKey("username-setup", user.id), 5, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    if (user.username) return Response.json({ error: "USERNAME_IMMUTABLE", message: "Your username is already set and cannot be changed." }, { status: 409 });

    const parsedBody = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(parsedBody);
    if (!parsed.success) return Response.json({ error: "INVALID_USERNAME", message: "Use 3–8 letters, numbers, underscores, or @." }, { status: 400 });

    const username = parsed.data.username.toLowerCase();
    const existing = await checkAvailability(username);
    if (existing) return Response.json({ error: "USERNAME_TAKEN", message: "That username is already taken. Try another one." }, { status: 409 });

    const claimed = await prisma.user.updateMany({
      where: { id: user.id, username: null },
      data: { username, displayUsername: parsed.data.username },
    });
    if (claimed.count !== 1) return Response.json({ error: "USERNAME_IMMUTABLE", message: "A username was already set for this account and cannot be changed." }, { status: 409 });
    return Response.json({ ok: true, username });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return Response.json({ error: "USERNAME_TAKEN", message: "That username is already taken. Try another one." }, { status: 409 });
    }
    return handleApiError(error);
  }
}
