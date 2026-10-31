import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { forbidden } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import {
  performUserAdminAction,
  type UserAdminAction,
} from "@/features/admin/users/user-management";
import { isSameOriginRequest } from "@/lib/security/same-origin";

const allowedActions: UserAdminAction[] = [
  "RESTRICT",
  "BAN",
  "RESTORE",
  "DELETE",
];

export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const actor = await requireAdmin();
    const limit = checkRateLimit(hashRateLimitKey("admin-user-detail", actor.id), 300, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const { userId } = await context.params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        phoneNumber: true,
        role: true,
        status: true,
        createdAt: true,
        lostItems: {
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, status: true, moderation: true, createdAt: true, deletedAt: true, _count: { select: { claims: true } } },
        },
        foundItems: {
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, status: true, moderation: true, createdAt: true, deletedAt: true, _count: { select: { claims: true } } },
        },
      },
    });
    if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const actor = await requireAdmin();
    if (actor.role === "USER") throw forbidden();
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "We couldn’t verify this page request. Refresh REVOK and try again." }, { status: 403 });
    }
    const limit = checkRateLimit(hashRateLimitKey("admin-user-action", actor.id), 30, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const { userId } = await context.params;
    const body = await request.json();
    const action = body.action;
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : "No reason provided";

    if (!allowedActions.includes(action)) {
      return NextResponse.json(
        { error: "Invalid admin action" },
        { status: 400 },
      );
    }

    const user = await performUserAdminAction(
      actor.id,
      actor.role,
      userId,
      action,
      reason,
    );

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
