import { requireAdmin } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { moderationReviewSchema } from "@/lib/items/report-validation";
import { isSameOriginRequest } from "@/lib/security/same-origin";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "We couldn’t verify this page request. Refresh REVOK and try again." }, { status: 403 });
    const admin = await requireAdmin();
    const limit = checkRateLimit(hashRateLimitKey("item-review", admin.id), 60, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const { id } = await params;
    const type = new URL(request.url).searchParams.get("type");
    if (type !== "LOST" && type !== "FOUND") return Response.json({ message: "Invalid report type." }, { status: 400 });
    const parsed = moderationReviewSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ message: "Choose a valid review status." }, { status: 400 });
    const where = { id, deletedAt: null };
    const target = type === "LOST" ? await prisma.lostItem.findFirst({ where, select: { userId: true } }) : await prisma.foundItem.findFirst({ where, select: { userId: true } });
    if (!target) return Response.json({ message: "Report not found." }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      const updated = type === "LOST" ? await tx.lostItem.updateMany({ where, data: { moderation: parsed.data.status } }) : await tx.foundItem.updateMany({ where, data: { moderation: parsed.data.status } });
      if (!updated.count) throw new Error("Report not found.");
      await tx.moderationEvent.create({ data: { userId: target.userId, entityType: `${type}_ITEM`, entityId: id, status: parsed.data.status, reason: parsed.data.reason, reviewedBy: admin.id, reviewedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: admin.id, action: `ITEM_${parsed.data.status}`, entityType: `${type}_ITEM`, entityId: id, details: parsed.data.reason ? { reason: parsed.data.reason } : undefined } });
    });
    return Response.json({ ok: true, status: parsed.data.status });
  } catch (error) { return handleApiError(error); }
}
