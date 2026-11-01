import { z } from "zod";
import { handleApiError } from "@/lib/api/handle-error";
import { requireActiveUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/security/same-origin";

export const runtime = "nodejs";
const schema = z.object({ reason: z.string().trim().min(3).max(100), description: z.string().trim().min(20).max(3000) }).strict();

export async function GET(_request: Request, { params }: { params: Promise<{ claimId: string }> }) {
  try {
    const user = await requireActiveUser();
    const { claimId } = await params;
    const claim = await prisma.claim.findFirst({ where: { id: claimId, OR: [{ userId: user.id }, { foundItem: { OR: [{ userId: user.id }, { custodianId: user.id }] } }] }, select: { id: true, conversation: { select: { participants: { where: { userId: user.id, deletedAt: null }, select: { id: true } } } }, foundItem: { select: { custodianId: true } } } });
    if (!claim || (!claim.conversation?.participants.length && claim.foundItem?.custodianId !== user.id)) return Response.json({ message: "Claim conversation not found." }, { status: 404 });
    const report = await prisma.userReport.findFirst({ where: { claimId, reporterId: user.id }, select: { id: true, reason: true, description: true, createdAt: true } });
    return Response.json({ report }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return handleApiError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ claimId: string }> }) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This request is not allowed." }, { status: 403 });
    const user = await requireActiveUser();
    const { claimId } = await params;
    const claim = await prisma.claim.findFirst({ where: { id: claimId, OR: [{ userId: user.id }, { foundItem: { OR: [{ userId: user.id }, { custodianId: user.id }] } }] }, select: { id: true, conversation: { select: { participants: { where: { userId: user.id, deletedAt: null }, select: { id: true } } } }, foundItem: { select: { custodianId: true } } } });
    if (!claim || (!claim.conversation?.participants.length && claim.foundItem?.custodianId !== user.id)) return Response.json({ message: "Claim conversation not found." }, { status: 404 });
    const removed = await prisma.userReport.deleteMany({ where: { claimId, reporterId: user.id } });
    if (!removed.count) return Response.json({ message: "There is no report to withdraw." }, { status: 404 });
    return Response.json({ ok: true, message: "Your report was withdrawn from admin review." });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ claimId: string }> }) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This request is not allowed." }, { status: 403 });
    const user = await requireActiveUser();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ message: "Choose a reason and describe what happened in at least 20 characters." }, { status: 400 });
    const { claimId } = await params;
    const claim = await prisma.claim.findFirst({ where: { id: claimId, OR: [{ userId: user.id }, { foundItem: { OR: [{ userId: user.id }, { custodianId: user.id }] } }] }, select: { id: true, userId: true, foundItemId: true, conversation: { select: { participants: { where: { userId: user.id, deletedAt: null }, select: { id: true } } } }, foundItem: { select: { custodianId: true } } } });
    if (!claim?.foundItemId) return Response.json({ message: "Claim not found." }, { status: 404 });
    if (!claim.conversation?.participants.length && claim.foundItem?.custodianId !== user.id) return Response.json({ message: "Conversation not found." }, { status: 404 });
    const reportedUserId = claim.userId === user.id
      ? (await prisma.foundItem.findUnique({ where: { id: claim.foundItemId }, select: { userId: true } }))?.userId
      : claim.userId;
    if (!reportedUserId || reportedUserId === user.id) return Response.json({ message: "The other participant could not be found." }, { status: 404 });
    try {
      await prisma.userReport.create({ data: { reporterId: user.id, reportedUserId, claimId, foundItemId: claim.foundItemId, reason: parsed.data.reason, description: parsed.data.description } });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return Response.json({ message: "You already reported this claim. Admins will review it." }, { status: 409 });
      throw error;
    }
    await prisma.notification.create({ data: { userId: reportedUserId, type: "MODERATION", title: "Claim review opened", message: "A claim-related concern was sent to REVOK administrators for review.", claimId: claim.id } });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}
