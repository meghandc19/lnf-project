import { randomBytes } from "node:crypto";
import { z } from "zod";
import { handleApiError } from "@/lib/api/handle-error";
import { requireActiveUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { encryptRecoveryCode, hashRecoveryCode } from "@/lib/claims/recovery-code";

export const runtime = "nodejs";
const actionSchema = z.object({ action: z.enum(["approve", "decline", "withdraw"]) }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ claimId: string }> }) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This request is not allowed." }, { status: 403 });
    const user = await requireActiveUser();
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ message: "Choose a valid claim action." }, { status: 400 });
    const { claimId } = await params;
    const claim = await prisma.claim.findUnique({ where: { id: claimId }, include: { foundItem: { select: { id: true, title: true, userId: true, custodianId: true, status: true } } } });
    if (!claim?.foundItem) return Response.json({ message: "Claim not found." }, { status: 404 });
    const finder = claim.foundItem.userId === user.id;
    const custodian = claim.foundItem.custodianId === user.id;
    const visibleParticipant = claim.conversationId ? await prisma.conversationParticipant.findFirst({ where: { conversationId: claim.conversationId, userId: user.id, deletedAt: null }, select: { id: true } }) : null;
    if (!visibleParticipant && !custodian) return Response.json({ message: "Conversation not found." }, { status: 404 });
    const action = parsed.data.action;
    if (action === "withdraw" && claim.userId !== user.id) return Response.json({ message: "Only the claimant can withdraw this request." }, { status: 403 });
    if (action !== "withdraw" && !finder && !custodian) return Response.json({ message: "Only the finder or current custodian can decide this claim." }, { status: 403 });
    if (action === "withdraw") {
      const changed = await prisma.claim.updateMany({ where: { id: claimId, userId: user.id, status: { in: ["PENDING", "APPROVED"] } }, data: { status: "CANCELLED", recoveryCodeHash: null, recoveryCodeCiphertext: null, recoveryCodeIv: null, recoveryCodeTag: null, recoveryCodeExpiresAt: null } });
      if (!changed.count) return Response.json({ message: "This claim has already been resolved." }, { status: 409 });
      await prisma.notification.create({ data: { userId: claim.foundItem.userId, type: "CLAIM", title: "Claim withdrawn", message: `A claim for “${claim.foundItem.title}” was withdrawn.`, claimId: claim.id } });
      return Response.json({ ok: true, status: "CANCELLED" });
    }
    if (claim.status !== "PENDING") return Response.json({ message: "This claim is no longer awaiting a decision." }, { status: 409 });
    if (action === "decline") {
      await prisma.$transaction(async (tx) => {
        await tx.claim.update({ where: { id: claimId }, data: { status: "REJECTED" } });
        await tx.notification.create({ data: { userId: claim.userId, type: "CLAIM", title: "Claim request declined", message: `Your claim for “${claim.foundItem!.title}” was declined. You can still review the conversation.`, claimId: claim.id } });
      });
      return Response.json({ ok: true, status: "REJECTED" });
    }
    if (claim.foundItem.status !== "ACTIVE") return Response.json({ message: "This item is no longer active." }, { status: 409 });
    const code = randomBytes(8).toString("hex").toUpperCase();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const encryptedCode = encryptRecoveryCode(code);
    const approved = await prisma.$transaction(async (tx) => {
      const otherApproved = await tx.claim.count({ where: { foundItemId: claim.foundItem!.id, status: "APPROVED", id: { not: claimId } } });
      if (otherApproved) return false;
      const changed = await tx.claim.updateMany({ where: { id: claimId, status: "PENDING", foundItem: { status: "ACTIVE" } }, data: { status: "APPROVED", recoveryCodeHash: hashRecoveryCode(code), ...encryptedCode, recoveryCodeExpiresAt: expiresAt, recoveryCodeIssuedAt: new Date(), recoveryCodeAttempts: 0 } });
      if (!changed.count) return false;
      await tx.notification.create({ data: { userId: claim.userId, type: "CLAIM", title: "Claim approved", message: `Your claim for “${claim.foundItem!.title}” was approved. Open the conversation to view your one-time recovery code.`, claimId: claim.id } });
      return true;
    }, { isolationLevel: "Serializable" });
    if (!approved) return Response.json({ message: "Another claim is already approved, or this claim changed while you were reviewing it. Refresh the conversation." }, { status: 409 });
    return Response.json({ ok: true, status: "APPROVED", expiresAt });
  } catch (error) { return handleApiError(error); }
}
