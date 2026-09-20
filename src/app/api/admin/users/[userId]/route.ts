import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
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
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  if (
    session.user.role !== "ADMIN" &&
    session.user.role !== "SUPER_ADMIN"
  ) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 },
    );
  }

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

  try {
    const user = await performUserAdminAction(
      session.user.id,
      userId,
      action,
      reason,
    );

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
  console.error("ADMIN USER ACTION ERROR:", error);

  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Unknown error",
    },
    { status: 500 },
  );
}
}