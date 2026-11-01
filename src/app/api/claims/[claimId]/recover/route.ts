import { z } from "zod";
import { handleApiError } from "@/lib/api/handle-error";
import { requireActiveUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { hashRecoveryCode } from "@/lib/claims/recovery-code";

export const runtime = "nodejs";
const schema = z.object({ code: z.string().trim().regex(/^[A-Fa-f0-9]{16}$/) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ claimId: string }> }) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This request is not allowed." }, { status: 403 });
    const user = await requireActiveUser();
    const limit = checkRateLimit(hashRateLimitKey("claim-recovery", user.id), 10, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const input = schema.safeParse(await request.json());
    if (!input.success) return Response.json({ message: "Enter the 16-character recovery code." }, { status: 400 });
    const { claimId } = await params;
    const claim = await prisma.claim.findUnique({ where: { id: claimId }, include: { foundItem: { select: { id: true, title: true, userId: true, custodianId: true, status: true } } } });
    if (!claim?.foundItem) return Response.json({ message: "Claim not found." }, { status: 404 });
    if (user.id !== claim.foundItem.userId && user.id !== claim.foundItem.custodianId) return Response.json({ message: "Only the finder or current custodian can confirm handover." }, { status: 403 });
    if (user.id !== claim.foundItem.custodianId) {
      const visibleParticipant = claim.conversationId ? await prisma.conversationParticipant.findFirst({ where: { conversationId: claim.conversationId, userId: user.id, deletedAt: null }, select: { id: true } }) : null;
      if (!visibleParticipant) return Response.json({ message: "Conversation not found." }, { status: 404 });
    }
    const outcome = await prisma.$transaction(async (tx) => {
      const current = await tx.claim.findUnique({ where: { id: claimId }, select: { status: true, recoveryCodeHash: true, recoveryCodeExpiresAt: true, recoveryCodeAttempts: true, recoveryCodeUsedAt: true } });
      if (!current || current.status !== "APPROVED" || current.recoveryCodeUsedAt || !current.recoveryCodeHash) return "inactive" as const;
      if (!current.recoveryCodeExpiresAt || current.recoveryCodeExpiresAt <= new Date()) return "expired" as const;
      if (current.recoveryCodeAttempts >= 5) return "locked" as const;
      if (hashRecoveryCode(input.data.code) !== current.recoveryCodeHash) {
        await tx.claim.updateMany({ where: { id: claimId, status: "APPROVED", recoveryCodeUsedAt: null }, data: { recoveryCodeAttempts: { increment: 1 } } });
        return "invalid" as const;
      }
      const changed = await tx.claim.updateMany({ where: { id: claimId, status: "APPROVED", recoveryCodeHash: current.recoveryCodeHash, recoveryCodeUsedAt: null, recoveryCodeExpiresAt: { gt: new Date() } }, data: { status: "RECOVERED", recoveryCodeHash: null, recoveryCodeCiphertext: null, recoveryCodeIv: null, recoveryCodeTag: null, recoveryCodeUsedAt: new Date(), recoveredAt: new Date() } });
      if (!changed.count) return "inactive" as const;
      const itemChanged = await tx.foundItem.updateMany({ where: { id: claim.foundItem!.id, status: "ACTIVE", deletedAt: null }, data: { status: "RETURNED" } });
      if (!itemChanged.count) throw new Error("ITEM_ALREADY_RESOLVED");
      const otherClaims = await tx.claim.findMany({ where: { foundItemId: claim.foundItem!.id, id: { not: claimId }, status: { in: ["PENDING", "APPROVED"] } }, select: { id: true, userId: true } });
      if (otherClaims.length) {
        await tx.claim.updateMany({ where: { id: { in: otherClaims.map((other) => other.id) } }, data: { status: "REJECTED", recoveryCodeHash: null, recoveryCodeCiphertext: null, recoveryCodeIv: null, recoveryCodeTag: null, recoveryCodeExpiresAt: null } });
        await tx.notification.createMany({ data: [...new Set(otherClaims.map((other) => other.userId))].filter((id) => id !== claim.userId).map((userId) => ({ userId, type: "CLAIM" as const, title: "Item recovered", message: `This item has been returned to its verified owner, so other open claims were closed.`, claimId: claim.id })) });
      }
      await tx.notification.createMany({ data: [{ userId: claim.userId, type: "CLAIM", title: "Item recovered", message: `The handover for “${claim.foundItem!.title}” has been confirmed.`, claimId: claim.id }, { userId: claim.foundItem!.userId, type: "CLAIM", title: "Item recovered", message: `The handover for “${claim.foundItem!.title}” has been confirmed.`, claimId: claim.id }] });
      if (claim.foundItem!.custodianId && claim.foundItem!.custodianId !== claim.foundItem!.userId) await tx.handoverRequest.updateMany({ where: { foundItemId: claim.foundItem!.id, stewardId: claim.foundItem!.custodianId, status: "ACCEPTED" }, data: { status: "COMPLETED", completedAt: new Date() } });
      return "success" as const;
    }, { isolationLevel: "Serializable" });
    if (outcome === "success") return Response.json({ ok: true });
    const messages = { inactive: "This recovery code is no longer active.", expired: "This recovery code has expired.", locked: "Too many incorrect attempts. The finder must review this claim.", invalid: "That recovery code is incorrect." };
    return Response.json({ message: messages[outcome] }, { status: 400 });
  } catch (error) { return handleApiError(error); }
}
