import { z } from "zod";
import { handleApiError } from "@/lib/api/handle-error";
import { requireActiveUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { usernameSchema } from "@/lib/validation/common";

const requestSchema = z.object({ username: usernameSchema }).strict();
const profileFields = { id: true, name: true, username: true, image: true } as const;

export async function GET() {
  try {
    const user = await requireActiveUser();
    const relationships = await prisma.friendship.findMany({
      where: { OR: [{ requesterId: user.id }, { recipientId: user.id }], status: { in: ["PENDING", "ACCEPTED"] } },
      orderBy: { updatedAt: "desc" },
      take: 300,
      include: { requester: { select: profileFields }, recipient: { select: profileFields } },
    });
    const friends = relationships.filter((entry) => entry.status === "ACCEPTED").map((entry) => ({ friendshipId: entry.id, user: entry.requesterId === user.id ? entry.recipient : entry.requester }));
    const incoming = relationships.filter((entry) => entry.status === "PENDING" && entry.recipientId === user.id).map((entry) => ({ id: entry.id, user: { id: entry.requester.id, username: entry.requester.username }, createdAt: entry.createdAt }));
    const outgoing = relationships.filter((entry) => entry.status === "PENDING" && entry.requesterId === user.id).map((entry) => ({ id: entry.id, user: { id: entry.recipient.id, username: entry.recipient.username }, createdAt: entry.createdAt }));
    return Response.json({ friends, incoming, outgoing }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This friend request is not allowed." }, { status: 403 });
    const user = await requireActiveUser();
    const limit = checkRateLimit(hashRateLimitKey("friend-request", user.id), 20, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ message: "Enter a valid username." }, { status: 400 });
    const target = await prisma.user.findFirst({ where: { username: { equals: parsed.data.username, mode: "insensitive" }, status: "ACTIVE", deletedAt: null }, select: profileFields });
    if (!target) return Response.json({ message: "No active REVOK user has that username." }, { status: 404 });
    if (target.id === user.id) return Response.json({ message: "You cannot add yourself as a friend." }, { status: 400 });
    const pairKey = [user.id, target.id].sort().join(":");
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.friendship.findUnique({ where: { pairKey } });
      if (existing?.status === "ACCEPTED") return { kind: "accepted" as const };
      if (existing?.status === "PENDING") return { kind: existing.requesterId === user.id ? "sent" as const : "incoming" as const };
      const relationship = existing
        ? await tx.friendship.update({ where: { id: existing.id }, data: { requesterId: user.id, recipientId: target.id, status: "PENDING", acceptedAt: null } })
        : await tx.friendship.create({ data: { pairKey, requesterId: user.id, recipientId: target.id } });
      await tx.notification.create({ data: { userId: target.id, type: "FRIEND_REQUEST", title: "New friend request", message: user.username ? `@${user.username} sent you a friend request.` : "A REVOK member sent you a friend request.", friendshipId: relationship.id, dedupeKey: `friend-request:${relationship.id}:${relationship.updatedAt.getTime()}` } });
      return { kind: "created" as const };
    }, { isolationLevel: "Serializable" });
    if (result.kind === "accepted") return Response.json({ message: "You are already friends with this user." }, { status: 409 });
    if (result.kind === "sent") return Response.json({ message: "A friend request is already pending." }, { status: 409 });
    if (result.kind === "incoming") return Response.json({ message: "This user already sent you a request. Review it in your Friends section." }, { status: 409 });
    return Response.json({ ok: true, message: "Friend request sent." }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return Response.json({ message: "A friend request already exists. Refresh your Friends section." }, { status: 409 });
    return handleApiError(error);
  }
}
