import { z } from "zod";
import { handleApiError } from "@/lib/api/handle-error";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/security/same-origin";

export const runtime = "nodejs";
const schema = z.object({ decision: z.string().trim().min(3).max(1000) }).strict();
export async function PATCH(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This request is not allowed." }, { status: 403 });
    const admin = await requireAdmin(); const { reportId } = await params; const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ message: "Record a short review decision." }, { status: 400 });
    const result = await prisma.userReport.updateMany({ where: { id: reportId }, data: { adminDecision: parsed.data.decision, reviewedBy: admin.id, reviewedAt: new Date() } });
    if (!result.count) return Response.json({ message: "Review case not found." }, { status: 404 });
    await prisma.auditLog.create({ data: { actorId: admin.id, action: "CLAIM_DISPUTE_REVIEWED", entityType: "USER_REPORT", entityId: reportId, details: { decision: parsed.data.decision } } });
    return Response.json({ ok: true });
  } catch (error) { return handleApiError(error); }
}
