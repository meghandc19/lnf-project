import { z } from "zod";

export const inventoryItemSchema = z.object({
  name: z.string().trim().min(2).max(100),
  brand: z.string().trim().max(100).optional(),
  color: z.string().trim().max(80).optional(),
}).strict();
