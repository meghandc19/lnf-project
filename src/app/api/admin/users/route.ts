import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    const limit = checkRateLimit(hashRateLimitKey("admin-user-list", admin.id), 300, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const params = new URL(request.url).searchParams;
    const search = params.get("search")?.trim().slice(0, 100) ?? "";
    const status = params.get("status");
    const role = params.get("role");
    const users = await prisma.user.findMany({
      where: {
        ...(status && ["ACTIVE", "RESTRICTED", "BANNED", "DELETED"].includes(status) ? { status: status as "ACTIVE" | "RESTRICTED" | "BANNED" | "DELETED" } : {}),
        ...(role && ["USER", "ADMIN", "SUPER_ADMIN"].includes(role) ? { role: role as "USER" | "ADMIN" | "SUPER_ADMIN" } : {}),
        ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { username: { contains: search, mode: "insensitive" as const } }] } : {}),
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ users });
  } catch (error) {
    return handleApiError(error);
  }
}
