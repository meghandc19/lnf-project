import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { canChangeManagedRole, isEligibleForAdminRole } from "./admin-policy";

export type ManagedRole = "USER" | "ADMIN";

export async function changeManagedRole(actorId: string, targetId: string, role: ManagedRole) {
  if (actorId === targetId) throw new ApiError(400, "SELF_ROLE_CHANGE", "You cannot change your own role.");

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, username: true, role: true, status: true, emailVerified: true, phoneNumberVerified: true },
    });
    if (!target) throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
    if (!canChangeManagedRole("SUPER_ADMIN", target.role)) throw new ApiError(403, "SUPER_ADMIN_PROTECTED", "Super Admin ownership can only be transferred through a deliberate ownership transfer.");
    if (role === "ADMIN" && !isEligibleForAdminRole(target)) {
      throw new ApiError(400, "USER_NOT_ELIGIBLE", "Only active users with a username and verified email or phone can be appointed as an admin.");
    }
    if (target.role === role) return target;

    const changed = await tx.user.updateMany({ where: { id: targetId, role: target.role, ...(role === "ADMIN" ? { status: "ACTIVE" as const } : {}) }, data: { role } });
    if (changed.count !== 1) throw new ApiError(409, "ROLE_CHANGED", "The account changed while this request was processed. Refresh and try again.");
    await tx.session.deleteMany({ where: { userId: targetId } });
    await tx.auditLog.create({
      data: { actorId, action: role === "ADMIN" ? "USER_PROMOTE_ADMIN" : "USER_REMOVE_ADMIN", entityType: "USER", entityId: targetId, details: { fromRole: target.role, toRole: role, targetUsername: target.username } },
    });
    return { id: target.id, name: target.name, username: target.username, role, status: target.status };
  });
}

export async function transferSuperAdmin(actorId: string, targetId: string) {
  if (actorId === targetId) throw new ApiError(400, "SELF_TRANSFER", "Choose another existing Admin account for the transfer.");
  return prisma.$transaction(async (tx) => {
    const [actor, target] = await Promise.all([
      tx.user.findUnique({ where: { id: actorId }, select: { id: true, role: true, status: true } }),
      tx.user.findUnique({ where: { id: targetId }, select: { id: true, name: true, username: true, role: true, status: true, emailVerified: true, phoneNumberVerified: true } }),
    ]);
    if (!actor || actor.role !== "SUPER_ADMIN" || actor.status !== "ACTIVE") throw new ApiError(403, "FORBIDDEN", "An active Super Admin is required.");
    if (!target || target.role !== "ADMIN" || !isEligibleForAdminRole(target)) throw new ApiError(400, "TRANSFER_TARGET_INELIGIBLE", "Ownership can only transfer to an active, verified Admin account.");
    const promoted = await tx.user.updateMany({ where: { id: targetId, role: "ADMIN", status: "ACTIVE" }, data: { role: "SUPER_ADMIN" } });
    const demoted = await tx.user.updateMany({ where: { id: actorId, role: "SUPER_ADMIN", status: "ACTIVE" }, data: { role: "ADMIN" } });
    if (promoted.count !== 1 || demoted.count !== 1) throw new ApiError(409, "TRANSFER_CONFLICT", "Account roles changed during the transfer. No changes were saved; refresh and try again.");
    await tx.session.deleteMany({ where: { userId: { in: [actorId, targetId] } } });
    await tx.auditLog.create({ data: { actorId, action: "SUPER_ADMIN_TRANSFER", entityType: "USER", entityId: targetId, details: { fromUserId: actorId, toUserId: targetId, targetUsername: target.username } } });
    return { id: target.id, name: target.name, username: target.username, role: "SUPER_ADMIN" as const };
  }, { isolationLevel: "Serializable" });
}
