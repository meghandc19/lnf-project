import type { UserStatus } from "@/generated/prisma/client";

export function canBrowse(status: UserStatus) {
  return (
    status === "ACTIVE" ||
    status === "RESTRICTED"
  );
}

export function hasVerifiedPhone(
  phoneNumberVerified: boolean,
) {
  return phoneNumberVerified === true;
}

export function canCreateReport(
  status: UserStatus,
  phoneNumberVerified: boolean,
) {
  return (
    status === "ACTIVE" &&
    phoneNumberVerified === true
  );
}

export function canMessage(
  status: UserStatus,
  phoneNumberVerified: boolean,
) {
  return (
    status === "ACTIVE" &&
    phoneNumberVerified === true
  );
}

export function canClaim(
  status: UserStatus,
  phoneNumberVerified: boolean,
) {
  return (
    status === "ACTIVE" &&
    phoneNumberVerified === true
  );
}

export function canChangePhone(
  status: UserStatus,
) {
  return status === "ACTIVE";
}