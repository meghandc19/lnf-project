import { requireActiveUser } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";
import { prisma } from "@/lib/prisma";
import { isSafeProfileImage, profileSchema } from "@/lib/profile/validation";
import {
  checkRateLimit,
  hashRateLimitKey,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

export async function PATCH(request: Request) {
  try {
    const requestOrigin = new URL(request.url).origin;
    if (request.headers.get("origin") !== requestOrigin) {
      return Response.json({ ok: false, message: "This profile request is not allowed." }, { status: 403 });
    }

    const user = await requireActiveUser();
    const limit = checkRateLimit(hashRateLimitKey("account-profile", user.id), 10, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);

    const body: unknown = await request.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success || !isSafeProfileImage(parsed.data?.image ?? "")) {
      return Response.json({ ok: false, message: "Check your profile details. Photo links must use HTTPS or a local path." }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.name,
        about: parsed.data.about || null,
        image: parsed.data.image || null,
      },
      select: { id: true, name: true, username: true, about: true, image: true },
    });

    return Response.json({ ok: true, user: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
