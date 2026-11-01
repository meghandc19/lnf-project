import { handleApiError } from "@/lib/api/handle-error";
import { requireActiveUser } from "@/lib/auth/guards";
import { decryptRecoveryCode } from "@/lib/claims/recovery-code";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ claimId: string }> }) {
  try {
    const user = await requireActiveUser(); const { claimId } = await params;
    const claim = await prisma.claim.findFirst({ where: { id: claimId, userId: user.id, conversation: { is: { participants: { some: { userId: user.id, deletedAt: null } } } }, status: "APPROVED", recoveryCodeUsedAt: null, recoveryCodeExpiresAt: { gt: new Date() } }, select: { recoveryCodeCiphertext: true, recoveryCodeIv: true, recoveryCodeTag: true, recoveryCodeExpiresAt: true } });
    if (!claim?.recoveryCodeCiphertext || !claim.recoveryCodeIv || !claim.recoveryCodeTag) return Response.json({ message: "No active recovery code is available." }, { status: 404 });
    return Response.json({ code: decryptRecoveryCode(claim.recoveryCodeCiphertext, claim.recoveryCodeIv, claim.recoveryCodeTag), expiresAt: claim.recoveryCodeExpiresAt }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return handleApiError(error); }
}
