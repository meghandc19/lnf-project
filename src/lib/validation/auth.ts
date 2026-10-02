import { z } from "zod";
import { usernameSchema, phoneSchema } from "./common";

export const usernamePasswordSchema = z.object({
  username: usernameSchema,
  password: z.string().min(8).max(128),
});

export const phonePasswordSchema = z.object({
  phoneNumber: phoneSchema,
  password: z.string().min(8).max(128),
});

export const setupCredentialsSchema = z.object({
  username: usernameSchema,
  password: z.string().min(8).max(128),
});