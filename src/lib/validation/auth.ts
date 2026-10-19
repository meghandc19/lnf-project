import { z } from "zod";
import {
  usernameSchema,
  indianPhoneSchema,
} from "./common";

export const usernamePasswordSchema = z.object({
  username: usernameSchema,
  password: z.string().min(8).max(128),
});

export const phonePasswordSchema = z.object({
  phoneNumber: indianPhoneSchema,
  password: z.string().min(8).max(128),
});

export const setupCredentialsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  username: usernameSchema,
  password: z.string().min(8).max(128),
});