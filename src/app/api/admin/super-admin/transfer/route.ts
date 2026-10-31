import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { transferSuperAdmin } from "@/features/admin/users/role-management";
import { isSameOriginRequest } from "@/lib/security/same-origin";

const bodySchema = z.object({ targetUserId: z.string().min(1).max(191), confirmEmail: z.string().email(), confirmPhrase: z.literal("TRANSFER SUPER ADMIN") }).strict();

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ error: "We couldn’t verify this page request. Refresh REVOK and try again." }, { status: 403 });
    const actor = await requireSuperAdmin();
    const limit = checkRateLimit(hashRateLimitKey("super-admin-transfer", actor.id), 1, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Confirm the transfer details to continue." }, { status: 400 });
    if (parsed.data.confirmEmail.trim().toLowerCase() !== actor.email.trim().toLowerCase()) {
      return Response.json({ error: "The confirmation email does not match your signed-in account." }, { status: 400 });
    }
    const user = await transferSuperAdmin(actor.id, parsed.data.targetUserId);
    return Response.json({ ok: true, user });
  } catch (error) {
    return handleApiError(error);
  }
}
