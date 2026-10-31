import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { isEligibleBootstrapAccount } from "../src/features/admin/users/admin-policy";

const bootstrapAction = "INITIAL_SUPER_ADMIN_BOOTSTRAPPED";
const bootstrapEntity = "SYSTEM";
const bootstrapEntityId = "initial-super-admin";

async function main() {
  const configuredEmail = process.env.REVOK_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (!configuredEmail || !/^[^\s@]+@gmail\.com$/.test(configuredEmail)) {
    throw new Error("Set REVOK_SUPER_ADMIN_EMAIL to the dedicated Gmail address before running this command.");
  }

  await prisma.$transaction(async (tx) => {
    // Claim the bootstrap lock across concurrent processes and app instances.
    const [lock] = await tx.$queryRaw<Array<{ acquired: boolean }>>`SELECT pg_try_advisory_xact_lock(731904, 1) AS acquired`;
    if (!lock?.acquired) throw new Error("Another Super Admin provisioning attempt is already running. No changes were made.");

    const alreadyBootstrapped = await tx.auditLog.findFirst({
      where: { action: bootstrapAction, entityType: bootstrapEntity, entityId: bootstrapEntityId },
      select: { id: true },
    });
    if (alreadyBootstrapped) throw new Error("Initial Super Admin provisioning has already been used.");

    const account = await tx.user.findFirst({
      where: { email: { equals: configuredEmail, mode: "insensitive" } },
      select: { id: true, email: true, emailVerified: true, status: true, deletedAt: true, role: true, username: true, accounts: { select: { providerId: true } } },
    });
    if (!account || !isEligibleBootstrapAccount(configuredEmail, { ...account, providerIds: account.accounts.map((linkedAccount) => linkedAccount.providerId) })) {
      throw new Error("No active, email-verified user linked to Google matches REVOK_SUPER_ADMIN_EMAIL. Sign in with that Google account first; no account or role was changed.");
    }

    const existingAdmins = await tx.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, id: { not: account.id } },
      select: { id: true, username: true, role: true },
    });
    await tx.user.updateMany({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, id: { not: account.id } }, data: { role: "USER" } });
    for (const priorAdmin of existingAdmins) {
      await tx.auditLog.create({
        data: {
          actorId: account.id,
          action: "BOOTSTRAP_REMOVE_ADMIN_ROLE",
          entityType: "USER",
          entityId: priorAdmin.id,
          details: { previousRole: priorAdmin.role, username: priorAdmin.username },
        },
      });
    }

    await tx.user.update({ where: { id: account.id }, data: { role: "SUPER_ADMIN" } });
    await tx.session.deleteMany({ where: { userId: { in: [account.id, ...existingAdmins.map((user) => user.id)] } } });
    await tx.auditLog.create({
      data: {
        actorId: account.id,
        action: bootstrapAction,
        entityType: bootstrapEntity,
        entityId: bootstrapEntityId,
        details: { targetUserId: account.id, username: account.username, priorRole: account.role },
      },
    });
  });

  console.log("Initial Super Admin provisioning completed. Sign in with the configured Google account.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Super Admin provisioning failed.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
