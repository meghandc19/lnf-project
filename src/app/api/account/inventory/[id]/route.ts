import { z } from "zod";
import { handleApiError } from "@/lib/api/handle-error";
import { requireActiveUser } from "@/lib/auth/guards";
import { normalizeSearchText } from "@/lib/items/matching";
import { inventoryItemSchema } from "@/lib/profile/inventory-validation";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { isSameOriginRequest } from "@/lib/security/same-origin";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This inventory request is not allowed." }, { status: 403 });
    const user = await requireActiveUser();
    const limit = checkRateLimit(hashRateLimitKey("account-inventory", user.id), 40, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const parsed = inventoryItemSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ message: "Enter an item name (2–100 characters); brand and color can be up to 100 and 80 characters." }, { status: 400 });
    const { id } = await params;
    const normalizedName = normalizeSearchText(parsed.data.name).slice(0, 100);
    if (!normalizedName) return Response.json({ message: "Enter an item name with letters or numbers." }, { status: 400 });
    const owned = await prisma.inventoryItem.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!owned) return Response.json({ message: "Inventory item not found." }, { status: 404 });
    const duplicate = await prisma.inventoryItem.findFirst({ where: { userId: user.id, normalizedName, id: { not: id } }, select: { id: true } });
    if (duplicate) return Response.json({ message: "You already have this item in your inventory." }, { status: 409 });
    const updated = await prisma.inventoryItem.updateMany({ where: { id, userId: user.id }, data: { name: parsed.data.name, normalizedName, brand: parsed.data.brand || null, color: parsed.data.color || null } });
    if (!updated.count) return Response.json({ message: "Inventory item not found." }, { status: 404 });
    const item = await prisma.inventoryItem.findUnique({ where: { id }, select: { id: true, name: true, brand: true, color: true } });
    return Response.json({ item });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return Response.json({ message: "You already have this item in your inventory." }, { status: 409 });
    if (error instanceof z.ZodError) return Response.json({ message: "Check the inventory details and try again." }, { status: 400 });
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This inventory request is not allowed." }, { status: 403 });
    const user = await requireActiveUser();
    const limit = checkRateLimit(hashRateLimitKey("account-inventory", user.id), 40, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const { id } = await params;
    const deleted = await prisma.inventoryItem.deleteMany({ where: { id, userId: user.id } });
    if (!deleted.count) return Response.json({ message: "Inventory item not found." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
