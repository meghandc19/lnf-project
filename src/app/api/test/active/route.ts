import { requireActiveUser } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";

export async function GET() {
  try {
    const user = await requireActiveUser();

    return Response.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}