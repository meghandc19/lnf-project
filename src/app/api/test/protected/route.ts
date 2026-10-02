import { requireLogin } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";

export async function GET() {
  try {
    const user = await requireLogin();

    return Response.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        status: user.status,
        phoneNumberVerified: user.phoneNumberVerified,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}