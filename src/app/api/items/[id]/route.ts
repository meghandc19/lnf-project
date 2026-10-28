import { getAuthenticatedUser, requirePhoneVerified } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/api/handle-error";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";
import { editReportSchema, reportOwnerWhere } from "@/lib/items/report-validation";
import { ITEM_CATEGORIES } from "@/lib/items/categories";

export const runtime = "nodejs";

function getKind(request: Request) {
  const type = new URL(request.url).searchParams.get("type");
  return type === "LOST" || type === "FOUND" ? type : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser();
    if (user?.status === "BANNED" || user?.status === "DELETED") return Response.json({ message: "Report not found." }, { status: 404 });
    const { id } = await params;
    const type = getKind(request);
    if (!type) return Response.json({ message: "Invalid report type." }, { status: 400 });
    const where = { id, deletedAt: null, OR: [{ moderation: "APPROVED" as const, status: "ACTIVE" as const }, ...(user && (user.status === "ACTIVE" || user.status === "RESTRICTED") ? [{ userId: user.id }] : [])] };
    const report = type === "LOST" ? await prisma.lostItem.findFirst({ where, include: { category: true, images: true } }) : await prisma.foundItem.findFirst({ where, include: { category: true, images: true } });
    if (!report) return Response.json({ message: "Report not found." }, { status: 404 });
    const isOwner = user?.id === report.userId;
    const publicData = Object.fromEntries(Object.entries(report).filter(([key]) => !["privateDetails", "contactedAbout", "userId"].includes(key)));
    const privateOwnerData = isOwner ? { privateDetails: report.privateDetails, ...("contactedAbout" in report ? { contactedAbout: report.contactedAbout } : {}) } : {};
    return Response.json({ report: { ...publicData, ...privateOwnerData, type } });
  } catch (error) { return handleApiError(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ message: "This request is not allowed." }, { status: 403 });
    const user = await requirePhoneVerified();
    const limit = checkRateLimit(hashRateLimitKey("item-mutation", user.id), 30, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const { id } = await params;
    const type = getKind(request);
    if (!type) return Response.json({ message: "Invalid report type." }, { status: 400 });
    const parsed = editReportSchema.safeParse(await request.json());
    if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) return Response.json({ message: "Check the report details and try again." }, { status: 400 });
    if (parsed.data.occurredAt && parsed.data.occurredAt.getTime() > Date.now()) return Response.json({ message: "The date cannot be in the future." }, { status: 400 });
    const { status, ...content } = parsed.data;
    const { category: categoryName, occurredAt, ...editableFields } = content;
    if (categoryName && !ITEM_CATEGORIES.includes(categoryName as (typeof ITEM_CATEGORIES)[number])) return Response.json({ message: "Select a valid category." }, { status: 400 });
    const category = categoryName ? await prisma.category.upsert({ where: { name: categoryName }, create: { name: categoryName }, update: {}, select: { id: true } }) : null;
    const where = reportOwnerWhere(id, user.id);
    const data = { ...editableFields, ...(category ? { categoryId: category.id } : {}), ...(occurredAt ? type === "LOST" ? { lostAt: occurredAt } : { foundAt: occurredAt } : {}), ...(Object.keys(editableFields).length || category || occurredAt ? { moderation: "PENDING" as const } : {}), ...(status ? { status } : {}) };
    const result = type === "LOST" ? await prisma.lostItem.updateMany({ where, data }) : await prisma.foundItem.updateMany({ where, data });
    if (!result.count) return Response.json({ message: "Report not found or not editable." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) { return handleApiError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ message: "This request is not allowed." }, { status: 403 });
    const user = await requirePhoneVerified();
    const limit = checkRateLimit(hashRateLimitKey("item-mutation", user.id), 30, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const { id } = await params;
    const type = getKind(request);
    if (!type) return Response.json({ message: "Invalid report type." }, { status: 400 });
    const where = reportOwnerWhere(id, user.id);
    const data = { deletedAt: new Date(), status: "REMOVED" as const };
    const result = type === "LOST" ? await prisma.lostItem.updateMany({ where, data }) : await prisma.foundItem.updateMany({ where, data });
    if (!result.count) return Response.json({ message: "Report not found or not yours." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) { return handleApiError(error); }
}
