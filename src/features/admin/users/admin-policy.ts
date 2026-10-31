export type AdminRole = "USER" | "ADMIN" | "SUPER_ADMIN";

export function canModerateTarget(actorRole: AdminRole, targetRole: AdminRole) {
  if (targetRole === "SUPER_ADMIN") return false;
  return actorRole === "SUPER_ADMIN" || targetRole === "USER";
}

export function canChangeManagedRole(actorRole: AdminRole, targetRole: AdminRole) {
  return actorRole === "SUPER_ADMIN" && targetRole !== "SUPER_ADMIN";
}

export function isEligibleForAdminRole(input: { status: string; username: string | null; emailVerified: boolean; phoneNumberVerified: boolean }) {
  return input.status === "ACTIVE" && Boolean(input.username) && (input.emailVerified || input.phoneNumberVerified);
}

export function isEligibleBootstrapAccount(configuredEmail: string, input: { email: string; emailVerified: boolean; status: string; deletedAt: Date | null; providerIds: string[] }) {
  return input.email.trim().toLowerCase() === configuredEmail.trim().toLowerCase()
    && input.emailVerified
    && input.status === "ACTIVE"
    && input.deletedAt === null
    && input.providerIds.includes("google");
}
