import { z } from "zod";
import { handleApiError } from "@/lib/api/handle-error";
import { requireActiveUser } from "@/lib/auth/guards";
import { inventoryItemSchema } from "@/lib/profile/inventory-validation";
import { normalizeSearchText } from "@/lib/items/matching";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { isSameOriginRequest } from "@/lib/security/same-origin";

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This inventory request is not allowed." }, { status: 403 });
    const user = await requireActiveUser();
    const limit = checkRateLimit(hashRateLimitKey("account-inventory", user.id), 40, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const parsed = inventoryItemSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ message: "Enter an item name (2–100 characters); brand and color can be up to 100 and 80 characters." }, { status: 400 });
    const normalizedName = normalizeSearchText(parsed.data.name).slice(0, 100);
    if (!normalizedName) return Response.json({ message: "Enter an item name with letters or numbers." }, { status: 400 });
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryItem.findUnique({ where: { userId_normalizedName: { userId: user.id, normalizedName } }, select: { id: true } });
      if (existing) return { kind: "duplicate" as const };
      const count = await tx.inventoryItem.count({ where: { userId: user.id } });
      if (count >= 10) return { kind: "limit" as const };
      const item = await tx.inventoryItem.create({ data: { userId: user.id, name: parsed.data.name, normalizedName, brand: parsed.data.brand || null, color: parsed.data.color || null }, select: { id: true, name: true, brand: true, color: true } });
      return { kind: "created" as const, item };
    }, { isolationLevel: "Serializable" });
    if (result.kind === "duplicate") return Response.json({ message: "You already have this item in your inventory." }, { status: 409 });
    if (result.kind === "limit") return Response.json({ message: "Your inventory is full. Delete an item before adding another." }, { status: 409 });
    return Response.json({ item: result.item }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ message: "Check the inventory details and try again." }, { status: 400 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return Response.json({ message: "You already have this item in your inventory." }, { status: 409 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return Response.json({ message: "Your inventory changed at the same time. Refresh and try again." }, { status: 409 });
    return handleApiError(error);
  }
}
