import { z } from "zod";

import { requirePhoneVerified } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";
import { ITEM_CATEGORIES } from "@/lib/items/categories";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { IMAGE_LIMITS, removeStoredImage, storeImage } from "@/lib/uploads/images";

export const runtime = "nodejs";

const reportSchema = z.object({
  type: z.enum(["LOST", "FOUND"]),
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(10).max(2000),
  location: z.string().trim().min(3).max(180),
  category: z.enum(ITEM_CATEGORIES),
  occurredAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
});

export async function POST(request: Request) {
  const savedImages: string[] = [];
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return Response.json({ message: "This report request is not allowed." }, { status: 403 });
    }
    const user = await requirePhoneVerified();
    const limit = checkRateLimit(hashRateLimitKey("item-report", user.id), 5, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > 3 * IMAGE_LIMITS.item + 256 * 1024) {
      return Response.json({ message: "Each image must be 5 MB or smaller; choose up to 3 images." }, { status: 413 });
    }

    const form = await request.formData();
    const parsed = reportSchema.safeParse({
      type: form.get("type"),
      title: form.get("title"),
      description: form.get("description"),
      location: form.get("location"),
      category: form.get("category"),
      occurredAt: form.get("occurredAt"),
    });
    if (!parsed.success) return Response.json({ message: "Check the required report details and try again." }, { status: 400 });
    if (parsed.data.occurredAt.getTime() > Date.now()) return Response.json({ message: "The date cannot be in the future." }, { status: 400 });

    const files = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
    if (files.length > 3) return Response.json({ message: "Choose up to 3 images." }, { status: 400 });
    for (const file of files) {
      const stored = await storeImage("items", file, IMAGE_LIMITS.item);
      savedImages.push(stored.storageKey);
    }

    const category = await prisma.category.upsert({
      where: { name: parsed.data.category },
      create: { name: parsed.data.category },
      update: {},
      select: { id: true },
    });
    const report = parsed.data.type === "LOST"
      ? await prisma.lostItem.create({
          data: {
            userId: user.id, categoryId: category.id, title: parsed.data.title,
            description: parsed.data.description, location: parsed.data.location,
            lostAt: parsed.data.occurredAt,
            images: { create: files.map((file, index) => ({ url: `/api/uploads/items/${savedImages[index].split("/").at(-1)}`, storageKey: savedImages[index], mimeType: file.type, sizeBytes: file.size })) },
          },
          select: { id: true, title: true, moderation: true },
        })
      : await prisma.foundItem.create({
          data: {
            userId: user.id, categoryId: category.id, title: parsed.data.title,
            description: parsed.data.description, location: parsed.data.location,
            foundAt: parsed.data.occurredAt,
            images: { create: files.map((file, index) => ({ url: `/api/uploads/items/${savedImages[index].split("/").at(-1)}`, storageKey: savedImages[index], mimeType: file.type, sizeBytes: file.size })) },
          },
          select: { id: true, title: true, moderation: true },
        });

    return Response.json({ ok: true, report: { ...report, type: parsed.data.type } }, { status: 201 });
  } catch (error) {
    await Promise.all(savedImages.map(removeStoredImage));
    if (error instanceof Error && (error.message.startsWith("Choose a JPEG") || error.message.startsWith("The selected file"))) {
      return Response.json({ message: error.message }, { status: 400 });
    }
    return handleApiError(error);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (type && type !== "LOST" && type !== "FOUND") {
    return Response.json({ message: "Invalid report type." }, { status: 400 });
  }
  const [lost, found] = await Promise.all([
    !type || type === "LOST" ? prisma.lostItem.findMany({ where: { deletedAt: null, status: "ACTIVE", moderation: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 50, include: { images: true, category: true } }) : [],
    !type || type === "FOUND" ? prisma.foundItem.findMany({ where: { deletedAt: null, status: "ACTIVE", moderation: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 50, include: { images: true, category: true } }) : [],
  ]);
  return Response.json({ reports: [...lost.map((report) => ({ ...report, type: "LOST" })), ...found.map((report) => ({ ...report, type: "FOUND" }))].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 50) });
}
