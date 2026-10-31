import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { changeManagedRole } from "@/features/admin/users/role-management";
import { isSameOriginRequest } from "@/lib/security/same-origin";

const bodySchema = z.object({ role: z.enum(["USER", "ADMIN"]) }).strict();

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    if (!isSameOriginRequest(request)) {
      return Response.json({ error: "We couldn’t verify this page request. Refresh REVOK and try again." }, { status: 403 });
    }
    const actor = await requireSuperAdmin();
    const limit = checkRateLimit(hashRateLimitKey("admin-role-change", actor.id), 10, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Choose a valid account role." }, { status: 400 });
    const { userId } = await context.params;
    const user = await changeManagedRole(actor.id, userId, parsed.data.role);
    return Response.json({ ok: true, user });
  } catch (error) {
    return handleApiError(error);
  }
}
