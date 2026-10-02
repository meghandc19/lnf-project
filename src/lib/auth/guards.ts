import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import {
  unauthorized,
  forbidden,
  phoneVerificationRequired,
} from "@/lib/api/errors";

export async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
  });

  return user;
}

export async function requireLogin() {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw unauthorized();
  }

  return user;
}

export async function requireActiveUser() {
  const user = await requireLogin();

  if (user.status !== "ACTIVE") {
    throw forbidden();
  }

  return user;
}

export async function requirePhoneVerified() {
  const user = await requireActiveUser();

  if (!user.phoneNumberVerified) {
    throw phoneVerificationRequired();
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireLogin();

  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    throw forbidden();
  }

  return user;
}

export async function requireSuperAdmin() {
  const user = await requireLogin();

  if (user.role !== "SUPER_ADMIN") {
    throw forbidden();
  }

  return user;
}