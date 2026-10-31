import { prisma } from "@/lib/prisma";
import { isEligibleBootstrapAccount } from "@/features/admin/users/admin-policy";

const setupAction = "CONFIGURED_SUPER_ADMIN_OWNER_SET";
const setupEntity = "configured-super-admin-owner";

/**
 * Promote the configured, verified Google owner when they create a normal
 * Better Auth session. This is an audited one-time setup path; subsequent
 * ownership changes remain under the explicit Super Admin transfer flow.
 */
export async function ensureConfiguredSuperAdmin(userId: string) {
  const configuredEmail = process.env.REVOK_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (!configuredEmail || !/^[^\s@]+@gmail\.com$/.test(configuredEmail)) return;

  const candidate = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      status: true,
      deletedAt: true,
      accounts: { select: { providerId: true } },
    },
  });
  if (!candidate || !isEligibleBootstrapAccount(configuredEmail, {
    ...candidate,
    providerIds: candidate.accounts.map((account) => account.providerId),
  })) return;

  const existingSetup = await prisma.auditLog.findFirst({
    where: { action: setupAction, entityType: "SYSTEM", entityId: setupEntity },
    select: { details: true },
  });
  if (existingSetup) {
    const details = existingSetup.details as { targetUserId?: string } | null;
    if (details?.targetUserId !== userId) return;
    return;
  }

  await prisma.$transaction(async (tx) => {
    const [lock] = await tx.$queryRaw<Array<{ acquired: boolean }>>`SELECT pg_try_advisory_xact_lock(731904, 2) AS acquired`;
    if (!lock?.acquired) return;

    const marker = await tx.auditLog.findFirst({
      where: { action: setupAction, entityType: "SYSTEM", entityId: setupEntity },
      select: { details: true },
    });
    if (marker) {
      const details = marker.details as { targetUserId?: string } | null;
      if (details?.targetUserId !== userId) return;
      return;
    }

    const current = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerified: true, status: true, deletedAt: true, role: true, accounts: { select: { providerId: true } } },
    });
    if (!current || !isEligibleBootstrapAccount(configuredEmail, {
      ...current,
      providerIds: current.accounts.map((account) => account.providerId),
    })) return;

    const previousOwners = await tx.user.findMany({
      where: { role: "SUPER_ADMIN", id: { not: userId } },
      select: { id: true, role: true },
    });
    if (previousOwners.length) {
      await tx.user.updateMany({
        where: { role: "SUPER_ADMIN", id: { not: userId } },
        data: { role: "ADMIN" },
      });
    }
    if (current.role !== "SUPER_ADMIN") {
      await tx.user.update({ where: { id: userId }, data: { role: "SUPER_ADMIN" } });
    }

    const affectedUserIds = [userId, ...previousOwners.map((owner) => owner.id)];
    await tx.session.deleteMany({ where: { userId: { in: affectedUserIds } } });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: setupAction,
        entityType: "SYSTEM",
        entityId: setupEntity,
        details: { targetUserId: userId, previousSuperAdminIds: previousOwners.map((owner) => owner.id) },
      },
    });
  });
}
