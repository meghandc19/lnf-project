import { z } from "zod";
import { handleApiError } from "@/lib/api/handle-error";
import { requireActiveUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
const messageSchema = z.object({ content: z.string().trim().min(1).max(2000) }).strict();

async function authorizedClaim(claimId: string, userId: string, admin = false) {
  const claim = await prisma.claim.findFirst({ where: { id: claimId, conversationId: { not: null }, ...(admin ? {} : { OR: [{ userId }, { foundItem: { OR: [{ userId }, { custodianId: userId }] } }] }) }, select: { id: true, status: true, userId: true, foundItem: { select: { title: true, location: true, custodyStatus: true, userId: true, custodianId: true, custodian: { select: { name: true, username: true } }, images: { take: 1, select: { url: true } } } }, conversation: { select: { id: true, participants: { where: { userId, deletedAt: null }, select: { id: true } } } } } });
  return claim;
}

export async function GET(_request: Request, { params }: { params: Promise<{ claimId: string }> }) {
  try {
    const user = await requireActiveUser();
    const { claimId } = await params;
    const claim = await authorizedClaim(claimId, user.id, user.role === "ADMIN" || user.role === "SUPER_ADMIN");
    if (!claim?.conversation || !claim.foundItem) return Response.json({ message: "Conversation not found." }, { status: 404 });
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN" && claim.conversation.participants.length === 0 && claim.foundItem.custodianId !== user.id) return Response.json({ message: "Conversation not found." }, { status: 404 });
    const otherId = claim.userId === user.id ? claim.foundItem.userId : claim.userId;
    const [messages, other] = await Promise.all([
      prisma.message.findMany({ where: { conversationId: claim.conversation.id, deletedAt: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 500, select: { id: true, content: true, senderId: true, createdAt: true, sender: { select: { name: true, username: true } } } }),
      prisma.user.findUnique({ where: { id: otherId }, select: { name: true, username: true, image: true } }),
    ]);
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN" && claim.conversation.participants.length) await prisma.conversationParticipant.updateMany({ where: { conversationId: claim.conversation.id, userId: user.id, deletedAt: null }, data: { lastReadAt: new Date() } });
    return Response.json({ claim: { id: claim.id, status: claim.status, viewerRole: user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "ADMIN" : claim.userId === user.id ? "CLAIMANT" : claim.foundItem.custodianId === user.id ? "CUSTODIAN" : "FINDER", item: claim.foundItem, other }, messages });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ claimId: string }> }) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This request is not allowed." }, { status: 403 });
    const user = await requireActiveUser();
    const limit = checkRateLimit(hashRateLimitKey("claim-message", user.id), 60, 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const body = messageSchema.safeParse(await request.json());
    if (!body.success) return Response.json({ message: "Messages must be between 1 and 2000 characters." }, { status: 400 });
    const { claimId } = await params;
    const claim = await authorizedClaim(claimId, user.id);
    if (!claim?.conversation || !claim.foundItem) return Response.json({ message: "Conversation not found." }, { status: 404 });
    if (claim.conversation.participants.length === 0 && claim.foundItem.custodianId !== user.id) return Response.json({ message: "Conversation not found." }, { status: 404 });
    if (["CANCELLED", "REJECTED"].includes(claim.status)) return Response.json({ message: "This conversation is closed, but its history remains available." }, { status: 409 });
    const message = await prisma.message.create({ data: { conversationId: claim.conversation.id, senderId: user.id, content: body.data.content }, select: { id: true, content: true, senderId: true, createdAt: true } });
    const recipientId = user.id === claim.userId ? claim.foundItem.userId : claim.userId;
    const recipientIsVisible = await prisma.conversationParticipant.findFirst({ where: { conversationId: claim.conversation.id, userId: recipientId, deletedAt: null }, select: { id: true } });
    if (recipientIsVisible) await prisma.notification.create({ data: { userId: recipientId, type: "MESSAGE", title: "New claim message", message: `There is a new message about “${claim.foundItem.title}”.`, claimId: claim.id } });
    return Response.json({ message }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}
