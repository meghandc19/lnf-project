import { z } from "zod";
import { handleApiError } from "@/lib/api/handle-error";
import { requireActiveUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";

const actionSchema = z.object({ action: z.enum(["accept", "reject", "cancel"]) }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ friendshipId: string }> }) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This friend request is not allowed." }, { status: 403 });
    const user = await requireActiveUser();
    const limit = checkRateLimit(hashRateLimitKey("friend-decision", user.id), 40, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ message: "Choose a valid friend-request action." }, { status: 400 });
    const { friendshipId } = await params;
    const friendship = await prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!friendship) return Response.json({ message: "Friend request not found." }, { status: 404 });
    const action = parsed.data.action;
    if (action === "cancel" ? friendship.requesterId !== user.id : friendship.recipientId !== user.id) return Response.json({ message: "You cannot manage this friend request." }, { status: 403 });
    if (friendship.status !== "PENDING") return Response.json({ message: "This friend request is no longer pending." }, { status: 409 });
    const status = action === "accept" ? "ACCEPTED" as const : action === "reject" ? "REJECTED" as const : "CANCELLED" as const;
    const changed = await prisma.$transaction(async (tx) => {
      const updated = await tx.friendship.updateMany({ where: { id: friendship.id, status: "PENDING", ...(action === "cancel" ? { requesterId: user.id } : { recipientId: user.id }) }, data: { status, ...(action === "accept" ? { acceptedAt: new Date() } : {}) } });
      if (!updated.count) return false;
      if (action === "accept") {
        await tx.notification.create({ data: { userId: friendship.requesterId, type: "FRIEND_ACCEPTED", title: "Friend request accepted", message: `${user.name}${user.username ? ` (@${user.username})` : ""} accepted your friend request.`, friendshipId: friendship.id, dedupeKey: `friend-accepted:${friendship.id}:${Date.now()}` } });
      }
      return true;
    });
    if (!changed) return Response.json({ message: "This friend request has already changed." }, { status: 409 });
    return Response.json({ ok: true, status });
  } catch (error) { return handleApiError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ friendshipId: string }> }) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This friend action is not allowed." }, { status: 403 });
    const user = await requireActiveUser();
    const limit = checkRateLimit(hashRateLimitKey("friend-remove", user.id), 30, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const { friendshipId } = await params;
    const changed = await prisma.friendship.updateMany({ where: { id: friendshipId, status: "ACCEPTED", OR: [{ requesterId: user.id }, { recipientId: user.id }] }, data: { status: "REMOVED", acceptedAt: null } });
    if (!changed.count) return Response.json({ message: "Friendship not found or already removed." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) { return handleApiError(error); }
}
