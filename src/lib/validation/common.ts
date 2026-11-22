import { z } from "zod";

export const idSchema = z.string().min(1);

export const usernameSchema = z
  .string()
  .trim()
  .min(4, "Username must be at least 4 characters.")
  .max(8, "Username must be 8 characters or fewer.")
  .regex(/^[a-zA-Z0-9_@]+$/, "Only letters, numbers, _ and @ are allowed.");

export const indianPhoneSchema = z
  .string()
  .trim()
  .refine(
    (value) => {
      const cleaned = value.replace(/\s+/g, "");

      return /^(?:\+?91)?[6-9]\d{9}$/.test(cleaned);
    },
    "Enter a valid Indian mobile number.",
  );

export function normalizeIndianPhone(phone: string) {
  const cleaned = phone.trim().replace(/\s+/g, "");

  if (cleaned.startsWith("+91")) {
    return cleaned.slice(3);
  }

  if (cleaned.startsWith("91") && cleaned.length === 12) {
    return cleaned.slice(2);
  }

  return cleaned;
}
