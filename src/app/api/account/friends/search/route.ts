import { handleApiError } from "@/lib/api/handle-error";
import { requireActiveUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  try {
    const user = await requireActiveUser();
    const limit = checkRateLimit(hashRateLimitKey("friend-search", user.id), 120, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 30) ?? "";
    if (query.length < 2) return Response.json({ users: [] }, { headers: { "Cache-Control": "private, no-store" } });
    const users = await prisma.user.findMany({ where: { id: { not: user.id }, status: "ACTIVE", deletedAt: null, username: { contains: query, mode: "insensitive" } }, orderBy: { username: "asc" }, take: 12, select: { id: true, username: true } });
    const ids = users.map((candidate) => candidate.id);
    const relations = ids.length ? await prisma.friendship.findMany({ where: { OR: [{ requesterId: user.id, recipientId: { in: ids } }, { recipientId: user.id, requesterId: { in: ids } }] }, select: { requesterId: true, recipientId: true, status: true } }) : [];
    const stateById = new Map(relations.map((relation) => [relation.requesterId === user.id ? relation.recipientId : relation.requesterId, relation.status === "PENDING" ? relation.requesterId === user.id ? "PENDING_SENT" : "PENDING_RECEIVED" : relation.status === "ACCEPTED" ? "ACCEPTED" : "NONE"]));
    const results = users.filter((candidate) => stateById.get(candidate.id) !== "ACCEPTED").map((candidate) => ({ ...candidate, relationship: stateById.get(candidate.id) ?? "NONE" }));
    return Response.json({ users: results }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return handleApiError(error); }
}
