import { z } from "zod";
import { handleApiError } from "@/lib/api/handle-error";
import { requirePhoneVerified } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const claimRequest = z.object({ foundItemId: z.string().trim().min(1).max(128), message: z.string().trim().min(10).max(1500) }).strict();

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This claim request is not allowed." }, { status: 403 });
    const user = await requirePhoneVerified();
    const limit = checkRateLimit(hashRateLimitKey("claim-request", user.id), 5, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const body = claimRequest.safeParse(await request.json());
    if (!body.success) return Response.json({ message: "Write at least 10 characters explaining why you believe this item is yours." }, { status: 400 });
    const { foundItemId, message } = body.data;
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        const item = await tx.foundItem.findFirst({ where: { id: foundItemId, deletedAt: null, status: "ACTIVE", moderation: "APPROVED" }, select: { id: true, title: true, userId: true } });
        if (!item) return { kind: "missing" as const };
        if (item.userId === user.id) return { kind: "owner" as const };
        const existing = await tx.claim.findFirst({ where: { userId: user.id, foundItemId }, select: { id: true, status: true } });
        if (existing) return { kind: "duplicate" as const, status: existing.status };
        const claim = await tx.claim.create({ data: { userId: user.id, foundItemId, message }, select: { id: true, status: true, createdAt: true } });
      await tx.notification.create({ data: { userId: item.userId, type: "CLAIM", title: "New claim request", message: `Someone sent a claim request for “${item.title}”. Open your dashboard to review it.` } });
        return { kind: "created" as const, claim };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
        const existing = await prisma.claim.findFirst({ where: { userId: user.id, foundItemId }, select: { status: true } });
        if (existing) return Response.json({ message: `You already sent a claim request for this item (${existing.status.toLowerCase()}).` }, { status: 409 });
        return Response.json({ message: "Another request is being processed. Please try sending your claim again." }, { status: 409 });
      }
      throw error;
    }
    if (result.kind === "missing") return Response.json({ message: "This found item is no longer available to claim." }, { status: 404 });
    if (result.kind === "owner") return Response.json({ message: "You cannot claim your own found report." }, { status: 403 });
    if (result.kind === "duplicate") return Response.json({ message: `You already sent a claim request for this item (${result.status.toLowerCase()}).` }, { status: 409 });
    return Response.json({ ok: true, claim: result.claim }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
