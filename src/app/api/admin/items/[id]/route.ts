import { requireAdmin } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { moderationReviewSchema } from "@/lib/items/report-validation";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { normalizeSearchText, scoreInventoryMatch } from "@/lib/items/matching";

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
    const target = type === "LOST"
      ? await prisma.lostItem.findFirst({ where, select: { userId: true, moderation: true } })
      : await prisma.foundItem.findFirst({ where, select: { id: true, userId: true, title: true, description: true, brand: true, color: true, subcategory: true, status: true, moderation: true, category: { select: { name: true } } } });
    if (!target) return Response.json({ message: "Report not found." }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      const updated = type === "LOST" ? await tx.lostItem.updateMany({ where, data: { moderation: parsed.data.status } }) : await tx.foundItem.updateMany({ where, data: { moderation: parsed.data.status } });
      if (!updated.count) throw new Error("Report not found.");
      await tx.moderationEvent.create({ data: { userId: target.userId, entityType: `${type}_ITEM`, entityId: id, status: parsed.data.status, reason: parsed.data.reason, reviewedBy: admin.id, reviewedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: admin.id, action: `ITEM_${parsed.data.status}`, entityType: `${type}_ITEM`, entityId: id, details: { ...(parsed.data.reason ? { reason: parsed.data.reason } : {}), previousStatus: target.moderation, nextStatus: parsed.data.status } } });
      const foundTarget = type === "FOUND" ? await tx.foundItem.findUnique({ where: { id }, select: { id: true, userId: true, title: true, description: true, brand: true, color: true, subcategory: true, status: true, category: { select: { name: true } } } }) : null;
      if (foundTarget && parsed.data.status === "APPROVED" && foundTarget.status === "ACTIVE") {
        const terms = [...new Set(normalizeSearchText(`${foundTarget.title} ${foundTarget.brand ?? ""} ${foundTarget.color ?? ""} ${foundTarget.subcategory ?? ""} ${foundTarget.category.name}`).split(" ").filter((token) => token.length >= 2))].slice(0, 10);
        if (terms.length) {
          const inventory = await tx.inventoryItem.findMany({ where: { userId: { not: foundTarget.userId }, user: { status: "ACTIVE", deletedAt: null }, OR: terms.map((token) => ({ normalizedName: { contains: token } })) }, take: 5000, select: { id: true, userId: true, name: true, brand: true, color: true } });
          const matches = inventory.filter((entry) => scoreInventoryMatch(entry, { title: foundTarget.title, brand: foundTarget.brand, color: foundTarget.color, subcategory: foundTarget.subcategory, category: foundTarget.category.name, description: foundTarget.description }) >= 50);
          if (matches.length) await tx.notification.createMany({ data: matches.map((entry) => ({ userId: entry.userId, type: "MATCH" as const, title: "Potential match found", message: `“${foundTarget.title}” may match an item you saved. This is only a potential match.`, foundItemId: foundTarget.id, inventoryItemId: entry.id })), skipDuplicates: true });
        }
      }
    });
    return Response.json({ ok: true, status: parsed.data.status });
  } catch (error) { return handleApiError(error); }
}
