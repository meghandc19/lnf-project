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
    const page = Math.max(1, Math.min(10000, Number.parseInt(params.get("page") ?? "1", 10) || 1));
    const sort = params.get("sort");
    const orderBy = sort === "name" ? { name: "asc" as const } : sort === "username" ? [{ username: "asc" as const }, { createdAt: "desc" as const }] : sort === "joined-oldest" ? { createdAt: "asc" as const } : { createdAt: "desc" as const };
    const where = {
        ...(status && ["ACTIVE", "RESTRICTED", "BANNED", "DELETED"].includes(status) ? { status: status as "ACTIVE" | "RESTRICTED" | "BANNED" | "DELETED" } : {}),
        ...(role && ["USER", "ADMIN", "SUPER_ADMIN", "REVOK_STEWARD"].includes(role) ? { role: role as "USER" | "ADMIN" | "SUPER_ADMIN" | "REVOK_STEWARD" } : {}),
        ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { username: { contains: search, mode: "insensitive" as const } }] } : {}),
    };
    const [users, total] = await Promise.all([prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy,
      skip: (page - 1) * 50,
      take: 50,
    }), prisma.user.count({ where })]);
    return NextResponse.json({ users, total, page, totalPages: Math.max(1, Math.ceil(total / 50)) });
  } catch (error) {
    return handleApiError(error);
  }
}
