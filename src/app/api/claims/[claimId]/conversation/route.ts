import { handleApiError } from "@/lib/api/handle-error";
import { requireActiveUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/security/same-origin";

export async function DELETE(request: Request, { params }: { params: Promise<{ claimId: string }> }) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This request is not allowed." }, { status: 403 });
    const user = await requireActiveUser();
    const { claimId } = await params;
    const claim = await prisma.claim.findFirst({ where: { id: claimId, conversationId: { not: null }, conversation: { is: { participants: { some: { userId: user.id, deletedAt: null } } } } }, select: { id: true, conversationId: true } });
    if (!claim?.conversationId) return Response.json({ message: "Conversation not found." }, { status: 404 });
    await prisma.$transaction([
      prisma.conversationParticipant.updateMany({ where: { conversationId: claim.conversationId, userId: user.id, deletedAt: null }, data: { deletedAt: new Date() } }),
      prisma.notification.updateMany({ where: { userId: user.id, claimId: claim.id, readAt: null }, data: { readAt: new Date() } }),
    ]);
    return Response.json({ ok: true });
  } catch (error) { return handleApiError(error); }
}
