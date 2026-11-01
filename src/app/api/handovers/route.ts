import { z } from "zod";
import { handleApiError } from "@/lib/api/handle-error";
import { requireActiveUser, requireLogin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/security/same-origin";

export const runtime = "nodejs";
const requestSchema = z.object({ foundItemId: z.string().min(1), stewardId: z.string().min(1) }).strict();
const actionSchema = z.object({ id: z.string().min(1), action: z.enum(["accept", "decline"]) }).strict();

export async function GET() {
  try {
    const user = await requireLogin();
    if (user.role === "REVOK_STEWARD") {
      const [requests, claims] = await Promise.all([
        prisma.handoverRequest.findMany({ where: { stewardId: user.id }, orderBy: { createdAt: "desc" }, take: 100, include: { foundItem: { select: { id: true, title: true, description: true, location: true, foundAt: true, category: { select: { name: true } }, images: { take: 1, select: { url: true } } } }, finder: { select: { name: true, username: true } } } }),
        prisma.claim.findMany({ where: { foundItem: { custodianId: user.id }, status: { in: ["PENDING", "APPROVED"] } }, orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { name: true, username: true } }, foundItem: { select: { title: true } } } }),
      ]);
      return Response.json({ requests, claims });
    }
    const stewards = await prisma.user.findMany({ where: { role: "REVOK_STEWARD", status: "ACTIVE" }, select: { id: true, name: true, username: true }, orderBy: { name: "asc" } });
    return Response.json({ stewards });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This request is not allowed." }, { status: 403 });
    const user = await requireActiveUser();
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ message: "Select a REVOK Steward." }, { status: 400 });
    const [item, steward] = await Promise.all([
      prisma.foundItem.findFirst({ where: { id: parsed.data.foundItemId, userId: user.id, deletedAt: null, status: "ACTIVE", custodianId: null }, select: { id: true, title: true, custodyStatus: true } }),
      prisma.user.findFirst({ where: { id: parsed.data.stewardId, role: "REVOK_STEWARD", status: "ACTIVE" }, select: { id: true } }),
    ]);
    if (!item || !steward) return Response.json({ message: "Item or Steward is unavailable." }, { status: 404 });
    const activeClaims = await prisma.claim.count({ where: { foundItemId: item.id, status: { in: ["PENDING", "APPROVED"] } } });
    if (activeClaims) return Response.json({ message: "This item has active claim requests. Resolve them before changing custody." }, { status: 409 });
    await prisma.$transaction(async (tx) => {
      const existing = await tx.handoverRequest.findFirst({ where: { foundItemId: item.id, status: "PENDING" } });
      if (existing) throw new Error("HANDOVER_PENDING");
      await tx.handoverRequest.create({ data: { foundItemId: item.id, finderId: user.id, stewardId: steward.id, previousCustodyStatus: item.custodyStatus } });
      const updated = await tx.foundItem.updateMany({ where: { id: item.id, userId: user.id, custodianId: null, status: "ACTIVE", claims: { none: { status: { in: ["PENDING", "APPROVED"] } } } }, data: { custodyStatus: "HANDOVER_PENDING" } });
      if (!updated.count) throw new Error("HANDOVER_CONFLICT");
      await tx.notification.create({ data: { userId: steward.id, type: "SYSTEM", title: "Handover request", message: `${item.title} was offered for REVOK Steward custody.` } });
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) { if (error instanceof Error && error.message === "HANDOVER_PENDING") return Response.json({ message: "A handover request is already pending for this item." }, { status: 409 }); if (error instanceof Error && error.message === "HANDOVER_CONFLICT") return Response.json({ message: "This item changed or gained an active claim. Refresh the page and try again." }, { status: 409 }); return handleApiError(error); }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This request is not allowed." }, { status: 403 });
    const user = await requireActiveUser();
    if (user.role !== "REVOK_STEWARD") return Response.json({ message: "Steward access is required." }, { status: 403 });
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ message: "Choose accept or decline." }, { status: 400 });
    const result = await prisma.$transaction(async (tx) => {
      const handover = await tx.handoverRequest.findFirst({ where: { id: parsed.data.id, stewardId: user.id, status: "PENDING" }, include: { foundItem: { select: { id: true, title: true, userId: true, custodianId: true, status: true } } } });
      if (!handover) return "missing" as const;
      if (parsed.data.action === "decline") {
        await tx.handoverRequest.update({ where: { id: handover.id }, data: { status: "DECLINED", respondedAt: new Date() } });
        await tx.foundItem.updateMany({ where: { id: handover.foundItem.id, custodianId: null, custodyStatus: "HANDOVER_PENDING" }, data: { custodyStatus: handover.previousCustodyStatus ?? "WITH_FINDER" } });
        await tx.notification.create({ data: { userId: handover.finderId, type: "SYSTEM", title: "Handover declined", message: `The Steward declined custody of “${handover.foundItem.title}”. You can choose another Steward.` } });
        return "declined" as const;
      }
      const changed = await tx.foundItem.updateMany({ where: { id: handover.foundItem.id, custodianId: null, status: "ACTIVE", deletedAt: null, custodyStatus: "HANDOVER_PENDING", claims: { none: { status: { in: ["PENDING", "APPROVED"] } } } }, data: { custodianId: user.id, custodyStatus: "WITH_STEWARD" } });
      if (!changed.count) return "conflict" as const;
      await tx.handoverRequest.update({ where: { id: handover.id }, data: { status: "ACCEPTED", respondedAt: new Date() } });
      await tx.notification.create({ data: { userId: handover.finderId, type: "SYSTEM", title: "Handover accepted", message: `The REVOK Steward accepted custody of “${handover.foundItem.title}”.` } });
      return "accepted" as const;
    }, { isolationLevel: "Serializable" });
    return result === "missing" ? Response.json({ message: "Pending handover not found." }, { status: 404 }) : result === "conflict" ? Response.json({ message: "Custody has changed. Refresh the dashboard." }, { status: 409 }) : Response.json({ ok: true, status: result });
  } catch (error) { return handleApiError(error); }
}
