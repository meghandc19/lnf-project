import { requirePhoneVerified } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";
import { reportSchema } from "@/lib/items/report-validation";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { IMAGE_LIMITS, isAllowedFoundItemPhotoSize, removeStoredImage, storeImage } from "@/lib/uploads/images";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const savedImages: string[] = [];
  try {
    if (!isSameOriginRequest(request)) {
      return Response.json({ message: "We couldn’t verify this page request. Refresh REVOK and try submitting again." }, { status: 403 });
    }
    const user = await requirePhoneVerified();
    const limit = checkRateLimit(hashRateLimitKey("item-report", user.id), 5, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > 3 * IMAGE_LIMITS.item + 256 * 1024) {
      return Response.json({ message: "Report photos exceed the upload limit. Choose up to 3 photos within the size limit." }, { status: 413 });
    }

    const form = await request.formData();
    const parsed = reportSchema.safeParse({
      type: form.get("type"),
      title: form.get("title"),
      description: form.get("description"),
      location: form.get("location"),
      category: form.get("category"),
      otherItemType: form.get("otherItemType") || undefined,
      subcategory: form.get("subcategory") || undefined,
      brand: form.get("brand") || undefined,
      model: form.get("model") || undefined,
      color: form.get("color") || undefined,
      material: form.get("material") || undefined,
      identifyingMarks: form.get("identifyingMarks") || undefined,
      privateDetails: form.get("privateDetails") || undefined,
      approximateTime: form.get("approximateTime") || undefined,
      occurredAtApproximate: form.get("occurredAtApproximate") === "true",
      locationDetails: form.get("locationDetails") || undefined,
      contactedAbout: form.get("contactedAbout") || undefined,
      custodyStatus: form.get("custodyStatus") || undefined,
      occurredAt: form.get("occurredAt"),
    });
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      const messages: Record<string, string> = {
        title: "Enter an item name between 3 and 100 characters.",
        category: "Select an item category.",
        color: "Enter the item’s color.",
        description: "Add a description of at least 10 characters.",
        location: "Enter the public place where the item was last seen or found.",
        occurredAt: "Choose a valid date and time.",
        privateDetails: "Private ownership detail must be 1,000 characters or fewer.",
      };
      return Response.json({ message: (field && messages[String(field)]) || "Some report details are invalid. Check the fields and try again." }, { status: 400 });
    }
    if (parsed.data.occurredAt.getTime() > Date.now()) return Response.json({ message: "The date cannot be in the future." }, { status: 400 });

    const files = form.getAll("images").filter((value): value is File => value instanceof File);
    if (files.length > 3) return Response.json({ message: "Choose up to 3 images." }, { status: 400 });
    if (parsed.data.type === "FOUND" && files.some((file) => !isAllowedFoundItemPhotoSize(file.size))) {
      return Response.json({ message: "Each found-item photo must be smaller than 4 MB." }, { status: 413 });
    }
    if (parsed.data.type === "LOST" && files.some((file) => file.size > IMAGE_LIMITS.lostItem)) {
      return Response.json({ message: "Each lost-item photo must be 3 MB or smaller." }, { status: 413 });
    }
    for (const file of files) {
      const maxBytes = parsed.data.type === "LOST" ? IMAGE_LIMITS.lostItem : IMAGE_LIMITS.foundItem;
      const stored = await storeImage("items", file, maxBytes);
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
            subcategory: parsed.data.category === "Other" ? parsed.data.otherItemType : undefined, brand: parsed.data.brand, model: undefined,
            color: parsed.data.color, material: undefined, identifyingMarks: undefined,
            privateDetails: parsed.data.privateDetails, approximateTime: parsed.data.occurredAtApproximate ? "Approximate" : undefined,
            locationDetails: undefined, contactedAbout: undefined,
            lostAt: parsed.data.occurredAt,
            images: { create: files.map((file, index) => ({ url: `/api/uploads/items/${savedImages[index].split("/").at(-1)}`, storageKey: savedImages[index], mimeType: file.type, sizeBytes: file.size })) },
          },
          select: { id: true, title: true, moderation: true },
        })
      : await prisma.foundItem.create({
          data: {
            userId: user.id, categoryId: category.id, title: parsed.data.title,
            description: parsed.data.description, location: parsed.data.location,
            subcategory: parsed.data.subcategory, brand: parsed.data.brand, model: parsed.data.model,
            color: parsed.data.color, material: parsed.data.material, identifyingMarks: parsed.data.identifyingMarks,
            privateDetails: parsed.data.privateDetails, approximateTime: parsed.data.approximateTime,
            locationDetails: parsed.data.locationDetails, custodyStatus: parsed.data.custodyStatus,
            foundAt: parsed.data.occurredAt,
            images: { create: files.map((file, index) => ({ url: `/api/uploads/items/${savedImages[index].split("/").at(-1)}`, storageKey: savedImages[index], mimeType: file.type, sizeBytes: file.size })) },
          },
          select: { id: true, title: true, moderation: true },
        });

    return Response.json({ ok: true, report: { ...report, type: parsed.data.type } }, { status: 201 });
  } catch (error) {
    await Promise.allSettled(savedImages.map(removeStoredImage));
    if (error instanceof Error && (error.message.startsWith("Choose a JPEG") || error.message.startsWith("Use a JPEG") || error.message.startsWith("Image size exceeded") || error.message.startsWith("The selected photo") || error.message.startsWith("This file"))) {
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
    !type || type === "LOST" ? prisma.lostItem.findMany({ where: { deletedAt: null, status: "ACTIVE", moderation: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, title: true, description: true, location: true, lostAt: true, createdAt: true, brand: true, model: true, color: true, subcategory: true, material: true, identifyingMarks: true, approximateTime: true, locationDetails: true, status: true, moderation: true, category: { select: { name: true } }, images: { select: { id: true, url: true, mimeType: true, sizeBytes: true } } } }) : [],
    !type || type === "FOUND" ? prisma.foundItem.findMany({ where: { deletedAt: null, status: "ACTIVE", moderation: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, title: true, description: true, location: true, foundAt: true, createdAt: true, brand: true, model: true, color: true, subcategory: true, material: true, identifyingMarks: true, approximateTime: true, locationDetails: true, custodyStatus: true, status: true, moderation: true, category: { select: { name: true } }, images: { select: { id: true, url: true, mimeType: true, sizeBytes: true } } } }) : [],
  ]);
  return Response.json({ reports: [...lost.map((report) => ({ ...report, type: "LOST" })), ...found.map((report) => ({ ...report, type: "FOUND" }))].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 50) });
}
