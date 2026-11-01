import { z } from "zod";
import { requireAdmin } from "@/lib/auth/authorization";
import { ApiError } from "@/lib/api/errors";
import { handleApiError } from "@/lib/api/handle-error";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { canModerateTarget } from "@/features/admin/users/admin-policy";
import type { ModerationStatus, UserStatus } from "@/generated/prisma/client";

const schema = z.object({ auditId: z.string().trim().min(1).max(128) }).strict();
const userStatuses = new Set<UserStatus>(["ACTIVE", "RESTRICTED", "BANNED"]);
const moderationStatuses = new Set<ModerationStatus>(["PENDING", "APPROVED", "FLAGGED", "BLOCKED"]);

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This admin action is not allowed." }, { status: 403 });
    const admin = await requireAdmin();
    const limit = checkRateLimit(hashRateLimitKey("admin-activity-undo", admin.id), 20, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ message: "Choose an activity to undo." }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      const entry = await tx.auditLog.findUnique({ where: { id: parsed.data.auditId } });
      if (!entry || !entry.entityId || !entry.actorId) throw new ApiError(404, "ACTIVITY_NOT_FOUND", "This activity can no longer be undone.");
      if (admin.role !== "SUPER_ADMIN" && entry.actorId !== admin.id) throw new ApiError(403, "FORBIDDEN", "Only the administrator who performed this action can undo it.");
      const age = Date.now() - entry.createdAt.getTime();
      if (age < 0 || age > 10 * 60 * 1000) throw new ApiError(410, "UNDO_EXPIRED", "The 10-minute undo window has expired.");
      const details = entry.details && typeof entry.details === "object" && !Array.isArray(entry.details) ? entry.details as Record<string, unknown> : {};
      const previousStatus = details.previousStatus;
      const nextStatus = details.nextStatus;
      if (typeof previousStatus !== "string" || typeof nextStatus !== "string") throw new ApiError(409, "NOT_REVERSIBLE", "This action does not have enough saved history to undo.");
      const laterEvent = await tx.auditLog.findFirst({ where: { entityType: entry.entityType, entityId: entry.entityId, createdAt: { gt: entry.createdAt } }, select: { id: true } });
      if (laterEvent) throw new ApiError(409, "ACTION_SUPERSEDED", "A newer action exists for this record, so this activity cannot be undone.");

      if (["USER_BAN", "USER_RESTRICT", "USER_RESTORE"].includes(entry.action) && entry.entityType === "USER") {
        if (!userStatuses.has(previousStatus as UserStatus) || !userStatuses.has(nextStatus as UserStatus)) throw new ApiError(409, "NOT_REVERSIBLE", "The saved account state is invalid.");
        const target = await tx.user.findUnique({ where: { id: entry.entityId }, select: { id: true, role: true, status: true } });
        if (!target) throw new ApiError(404, "USER_NOT_FOUND", "This account no longer exists.");
        if (!canModerateTarget(admin.role, target.role)) throw new ApiError(403, "FORBIDDEN", "You cannot manage this administrator account.");
        if (target.status !== nextStatus) throw new ApiError(409, "STATE_CHANGED", "The account status has changed since this activity.");
        await tx.user.update({ where: { id: target.id }, data: { status: previousStatus as UserStatus } });
        if (previousStatus === "BANNED") await tx.session.deleteMany({ where: { userId: target.id } });
      } else if (["ITEM_APPROVED", "ITEM_FLAGGED", "ITEM_BLOCKED"].includes(entry.action) && ["LOST_ITEM", "FOUND_ITEM"].includes(entry.entityType)) {
        if (!moderationStatuses.has(previousStatus as ModerationStatus) || !moderationStatuses.has(nextStatus as ModerationStatus)) throw new ApiError(409, "NOT_REVERSIBLE", "The saved report state is invalid.");
        const isFound = entry.entityType === "FOUND_ITEM";
        const target = isFound
          ? await tx.foundItem.findFirst({ where: { id: entry.entityId, deletedAt: null }, select: { id: true, userId: true, moderation: true } })
          : await tx.lostItem.findFirst({ where: { id: entry.entityId, deletedAt: null }, select: { id: true, userId: true, moderation: true } });
        if (!target) throw new ApiError(404, "REPORT_NOT_FOUND", "This report no longer exists.");
        if (target.moderation !== nextStatus) throw new ApiError(409, "STATE_CHANGED", "The report status has changed since this activity.");
        if (isFound) {
          await tx.foundItem.update({ where: { id: target.id }, data: { moderation: previousStatus as ModerationStatus } });
          if (nextStatus === "APPROVED" && previousStatus !== "APPROVED") await tx.notification.deleteMany({ where: { foundItemId: target.id, type: "MATCH" } });
        } else await tx.lostItem.update({ where: { id: target.id }, data: { moderation: previousStatus as ModerationStatus } });
        await tx.moderationEvent.create({ data: { userId: target.userId, entityType: entry.entityType, entityId: target.id, status: previousStatus as ModerationStatus, reason: "Admin reversed a recent review action.", reviewedBy: admin.id, reviewedAt: new Date() } });
      } else throw new ApiError(409, "NOT_REVERSIBLE", "This activity cannot be undone here.");

      await tx.auditLog.create({ data: { actorId: admin.id, action: "ADMIN_ACTION_UNDONE", entityType: entry.entityType, entityId: entry.entityId, details: { originalAuditId: entry.id, restoredStatus: previousStatus } } });
    }, { isolationLevel: "Serializable" });
    return Response.json({ ok: true, message: "The recent action was undone." });
  } catch (error) { return handleApiError(error); }
}
