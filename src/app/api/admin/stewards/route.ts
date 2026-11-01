import { z } from "zod";
import { handleApiError } from "@/lib/api/handle-error";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/security/same-origin";

export const runtime = "nodejs";
const schema = z.object({ userId: z.string().min(1), assign: z.boolean() }).strict();

export async function GET() {
  try {
    await requireAdmin();
    const stewards = await prisma.user.findMany({ where: { role: "REVOK_STEWARD", status: "ACTIVE" }, select: { id: true, name: true, username: true, image: true }, orderBy: { name: "asc" } });
    return Response.json({ stewards });
  } catch (error) { return handleApiError(error); }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This request is not allowed." }, { status: 403 });
    const actor = await requireAdmin();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ message: "Choose an eligible user." }, { status: 400 });
    const target = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, role: true, status: true } });
    if (!target || target.status !== "ACTIVE" || !["USER", "REVOK_STEWARD"].includes(target.role)) return Response.json({ message: "Only active standard users can be assigned or removed as Stewards." }, { status: 409 });
    if (target.id === actor.id) return Response.json({ message: "You cannot change your own role here." }, { status: 409 });
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: target.id }, data: { role: parsed.data.assign ? "REVOK_STEWARD" : "USER" } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: parsed.data.assign ? "STEWARD_ASSIGNED" : "STEWARD_REVOKED", entityType: "USER", entityId: target.id } });
      if (!parsed.data.assign) await tx.handoverRequest.updateMany({ where: { stewardId: target.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    });
    return Response.json({ ok: true });
  } catch (error) { return handleApiError(error); }
}
