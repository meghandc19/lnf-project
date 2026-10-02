import { z } from "zod";

export const idSchema = z.string().min(1);

export const usernameSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_.]+$/);

export const phoneSchema = z
  .string()
  .min(10)
  .max(20);