import { requireActiveUser } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { IMAGE_LIMITS, removeStoredImage, storeImage } from "@/lib/uploads/images";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return Response.json({ message: "This photo upload is not allowed." }, { status: 403 });
    }
    const user = await requireActiveUser();
    const limit = checkRateLimit(hashRateLimitKey("profile-photo", user.id), 10, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > IMAGE_LIMITS.profile + 64 * 1024) {
      return Response.json({ message: "Profile photos must be 8 MB or smaller." }, { status: 413 });
    }
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return Response.json({ message: "Choose a photo to upload." }, { status: 400 });

    const stored = await storeImage("profiles", file, IMAGE_LIMITS.profile);
    try {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { image: stored.url },
        select: { image: true },
      });
      const oldKey = user.image?.match(/^\/uploads\/(profiles\/[a-f0-9-]+\.(?:jpg|png|webp))$/i)?.[1];
      if (oldKey) {
        try { await removeStoredImage(oldKey); } catch { /* Keep the saved photo valid if old-file cleanup fails. */ }
      }
      return Response.json({ ok: true, image: updated.image });
    } catch (error) {
      await removeStoredImage(stored.storageKey);
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Choose a JPEG")) {
      return Response.json({ message: error.message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
