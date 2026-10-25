import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  about: z.string().trim().max(280),
  image: z.string().trim().max(2048),
}).strict();

export function isSafeProfileImage(value: string) {
  if (!value) return true;
  if (/^\/(?![\\/])[^\\\u0000-\u001f]*$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
