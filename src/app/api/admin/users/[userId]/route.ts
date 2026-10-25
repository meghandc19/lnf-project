import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";
import {
  performUserAdminAction,
  type UserAdminAction,
} from "@/features/admin/users/user-management";

const allowedActions: UserAdminAction[] = [
  "RESTRICT",
  "BAN",
  "RESTORE",
  "DELETE",
];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const actor = await requireAdmin();
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
