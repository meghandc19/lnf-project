import { z } from "zod";
import { ITEM_CATEGORIES } from "./categories.ts";

export const reportSchema = z.object({
  type: z.enum(["LOST", "FOUND"]),
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(10).max(2000),
  location: z.string().trim().min(3).max(180),
  category: z.enum(ITEM_CATEGORIES),
  otherItemType: z.string().trim().max(80).optional(),
  subcategory: z.string().trim().max(80).optional(),
  brand: z.string().trim().max(100).optional(),
  model: z.string().trim().max(100).optional(),
  color: z.string().trim().max(80).optional(),
  material: z.string().trim().max(120).optional(),
  identifyingMarks: z.string().trim().max(500).optional(),
  privateDetails: z.string().trim().max(1000).optional(),
  approximateTime: z.string().trim().max(80).optional(),
  occurredAtApproximate: z.boolean().optional(),
  locationDetails: z.string().trim().max(300).optional(),
  contactedAbout: z.string().trim().max(200).optional(),
  custodyStatus: z.enum(["WITH_FINDER", "SECURITY_OFFICE", "HANDED_OVER", "UNKNOWN"]).optional(),
  occurredAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
}).superRefine((report, context) => {
  if (report.type === "LOST" && !report.color?.trim()) {
    context.addIssue({ code: "custom", path: ["color"], message: "Color is required for lost item reports." });
  }
});

export const editReportSchema = z.object({
  title: z.string().trim().min(3).max(100).optional(),
  description: z.string().trim().min(10).max(2000).optional(),
  location: z.string().trim().min(3).max(180).optional(),
  category: z.enum(ITEM_CATEGORIES).optional(),
  occurredAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)).optional(),
  subcategory: z.string().trim().max(80).nullable().optional(),
  brand: z.string().trim().max(100).nullable().optional(),
  model: z.string().trim().max(100).nullable().optional(),
  color: z.string().trim().max(80).nullable().optional(),
  material: z.string().trim().max(120).nullable().optional(),
  identifyingMarks: z.string().trim().max(500).nullable().optional(),
  privateDetails: z.string().trim().max(1000).nullable().optional(),
  approximateTime: z.string().trim().max(80).nullable().optional(),
  locationDetails: z.string().trim().max(300).nullable().optional(),
  contactedAbout: z.string().trim().max(200).nullable().optional(),
  custodyStatus: z.enum(["WITH_FINDER", "SECURITY_OFFICE", "HANDED_OVER", "UNKNOWN"]).nullable().optional(),
  status: z.enum(["ACTIVE", "CLOSED"]).optional(),
}).strict();

export const moderationReviewSchema = z.object({
  status: z.enum(["APPROVED", "FLAGGED", "BLOCKED"]),
  reason: z.string().trim().max(500).optional(),
}).strict();

export function reportOwnerWhere(id: string, userId: string) {
  return { id, userId, deletedAt: null } as const;
}
