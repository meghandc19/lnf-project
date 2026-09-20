import { prisma } from "@/lib/prisma";

export type UserAdminAction =
  | "RESTRICT"
  | "BAN"
  | "RESTORE"
  | "DELETE";

export async function performUserAdminAction(
  actorId: string,
  targetUserId: string,
  action: UserAdminAction,
  reason = "No reason provided",
) {
  if (actorId === targetUserId) {
    throw new Error("Administrators cannot modify their own account.");
  }

  return prisma.$transaction(async (tx) => {
    // RESTORE / RESTRICT / BAN
    if (action !== "DELETE") {
      const status =
        action === "RESTRICT"
          ? "RESTRICTED"
          : action === "BAN"
            ? "BANNED"
            : "ACTIVE";

      const user = await tx.user.update({
        where: { id: targetUserId },
        data: {
          status,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          status: true,
          deletedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: `USER_${action}`,
          entityType: "USER",
          entityId: targetUserId,
          details: {
            targetUsername: user.username,
            reason,
          },
        },
      });

      return user;
    }

    // Get user before permanently deleting anything.
    const user = await tx.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        username: true,
      },
    });

    if (!user) {
      throw new Error("User not found.");
    }

    // Preserve minimal deletion record.
    await tx.userDeletionRecord.create({
      data: {
        originalUserId: user.id,
        name: user.name,
        username: user.username,
        reason,
        deletedBy: actorId,
      },
    });

    // Find items belonging to this user.
    const lostItems = await tx.lostItem.findMany({
      where: { userId: targetUserId },
      select: { id: true },
    });

    const foundItems = await tx.foundItem.findMany({
      where: { userId: targetUserId },
      select: { id: true },
    });

    const lostItemIds = lostItems.map((item) => item.id);
    const foundItemIds = foundItems.map((item) => item.id);

    // Delete claims connected to these items.
    await tx.claim.deleteMany({
      where: {
        OR: [
          { userId: targetUserId },
          { lostItemId: { in: lostItemIds } },
          { foundItemId: { in: foundItemIds } },
        ],
      },
    });

    // Delete matches connected to these items.
    await tx.match.deleteMany({
      where: {
        OR: [
          { lostItemId: { in: lostItemIds } },
          { foundItemId: { in: foundItemIds } },
        ],
      },
    });

    // Delete item images.
    await tx.itemImage.deleteMany({
      where: {
        OR: [
          { lostItemId: { in: lostItemIds } },
          { foundItemId: { in: foundItemIds } },
        ],
      },
    });

    // Delete the user's lost/found reports.
    await tx.lostItem.deleteMany({
      where: { userId: targetUserId },
    });

    await tx.foundItem.deleteMany({
      where: { userId: targetUserId },
    });

    // Delete messages sent by the user.
    await tx.message.deleteMany({
      where: { senderId: targetUserId },
    });

    // Remove conversation membership.
    await tx.conversationParticipant.deleteMany({
      where: { userId: targetUserId },
    });

    // Delete notifications.
    await tx.notification.deleteMany({
      where: { userId: targetUserId },
    });

    // Moderation history keeps the event but removes the user reference.
    await tx.moderationEvent.updateMany({
      where: { userId: targetUserId },
      data: { userId: null },
    });

    // Preserve audit history but remove the foreign-key reference
    // to the user who is about to be permanently deleted.
    await tx.auditLog.updateMany({
      where: { actorId: targetUserId },
      data: { actorId: null },
    });

    // Sessions and Accounts have onDelete: Cascade.
    // Finally remove the actual User.
    await tx.user.delete({
      where: { id: targetUserId },
    });

    // Record the deletion action using the admin as actor.
    await tx.auditLog.create({
      data: {
        actorId,
        action: "USER_DELETE",
        entityType: "USER",
        entityId: targetUserId,
        details: {
          deletedUsername: user.username,
          reason,
          permanent: true,
        },
      },
    });

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      status: "PERMANENTLY_DELETED",
    };
  });
}