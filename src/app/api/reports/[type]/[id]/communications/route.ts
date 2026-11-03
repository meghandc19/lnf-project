import { z } from "zod";
import { handleApiError } from "@/lib/api/handle-error";
import { requireActiveUser, requireCanBrowse } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { checkRateLimit, hashRateLimitKey, rateLimitResponse } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const messageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  parentMessageId: z.string().trim().min(1).max(128).optional(),
  clientRequestId: z.string().uuid(),
}).strict();

async function getReport(type: string, id: string, userId: string, moderator = false) {
  const where = { id, deletedAt: null, ...(moderator ? {} : { OR: [{ status: "ACTIVE" as const, moderation: "APPROVED" as const }, { userId }] }) };
  return type === "lost"
    ? await prisma.lostItem.findFirst({ where, select: { id: true, title: true, userId: true, status: true, moderation: true } })
    : type === "found"
      ? await prisma.foundItem.findFirst({ where, select: { id: true, title: true, userId: true, status: true, moderation: true } })
      : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  try {
    const user = await requireCanBrowse();
    const { type, id } = await params;
    const moderator = user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "REVOK_STEWARD";
    const query = new URL(request.url);
    const threadId = query.searchParams.get("thread");
    let report = await getReport(type, id, user.id, moderator);
    if (!report && threadId && (type === "lost" || type === "found")) {
      const hiddenReport = type === "lost"
        ? await prisma.lostItem.findFirst({ where: { id, deletedAt: null }, select: { id: true, title: true, userId: true, status: true, moderation: true } })
        : await prisma.foundItem.findFirst({ where: { id, deletedAt: null }, select: { id: true, title: true, userId: true, status: true, moderation: true } });
      const ownThread = hiddenReport ? await prisma.reportMessage.findFirst({ where: { id: threadId, parentMessageId: null, senderId: user.id, reportOwnerId: hiddenReport.userId, ...(type === "lost" ? { lostItemId: id } : { foundItemId: id }) }, select: { id: true } }) : null;
      if (ownThread) report = hiddenReport;
    }
    if (!report) return Response.json({ message: "Report not found." }, { status: 404 });
    const isOwner = report.userId === user.id;
    const isModerator = moderator;
    if (!isOwner && !isModerator && threadId) {
      const ownMessage = await prisma.reportMessage.findFirst({ where: { id: threadId, senderId: user.id, ...(type === "lost" ? { lostItemId: id } : { foundItemId: id }) }, select: { id: true } });
      if (!ownMessage) return Response.json({ message: "Private conversation not found." }, { status: 404 });
    }
    if (!isOwner && !isModerator && !threadId) {
      const hasMessage = await prisma.reportMessage.findFirst({ where: { ...(type === "lost" ? { lostItemId: id } : { foundItemId: id }), senderId: user.id }, select: { id: true } });
      if (!hasMessage) return Response.json({ message: "Private conversation not found." }, { status: 404 });
    }
    const visibility = isOwner || isModerator ? {} : { OR: [{ senderId: user.id }, { parent: { is: { senderId: user.id } } }] };
    const messages = await prisma.reportMessage.findMany({
      where: { ...(type === "lost" ? { lostItemId: id } : { foundItemId: id }), ...visibility },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 500,
      select: { id: true, kind: true, body: true, location: true, sightingAt: true, createdAt: true, parentMessageId: true, senderId: true, sender: { select: { id: true, name: true, username: true, image: true } } },
    });
    const filtered = threadId && !isOwner && !isModerator ? messages.filter((message) => message.id === threadId || message.parentMessageId === threadId) : messages;
    return Response.json({ report: { id: report.id, type: type.toUpperCase(), title: report.title }, isOwner, isModerator, canReply: user.status === "ACTIVE" && (isOwner || (!isModerator && Boolean(threadId))), messages: filtered }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This private message is not allowed." }, { status: 403 });
    const user = await requireActiveUser();
    const { type, id } = await params;
    if (type !== "lost" && type !== "found") return Response.json({ message: "Report not found." }, { status: 404 });
    const limit = checkRateLimit(hashRateLimitKey("report-message", user.id, id), 12, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);
    const parsed = messageSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ message: "Enter a message of 1 to 2,000 characters." }, { status: 400 });
    const input = parsed.data;
    const report = await getReport(type, id, user.id);
    if (!report) return Response.json({ message: "Report not found." }, { status: 404 });
    const retry = await prisma.reportMessage.findUnique({ where: { clientRequestId: input.clientRequestId }, select: { id: true, senderId: true } });
    if (retry) return retry.senderId === user.id ? Response.json({ ok: true, id: retry.id }) : Response.json({ message: "Message request is invalid." }, { status: 409 });

    const kind = "HINT" as const;
    let parentMessageId: string | null = null;
    let recipientId = report.userId;
    if (input.parentMessageId) {
      const parent = await prisma.reportMessage.findFirst({ where: { id: input.parentMessageId, parentMessageId: null, reportOwnerId: report.userId, ...(type === "lost" ? { lostItemId: id } : { foundItemId: id }) }, select: { id: true, kind: true, senderId: true } });
      if (!parent || (user.id !== report.userId && user.id !== parent.senderId)) return Response.json({ message: "Private conversation not found." }, { status: 404 });
      if (user.id === report.userId && parent.senderId !== report.userId) recipientId = parent.senderId;
      parentMessageId = parent.id;
    } else {
      if (user.id === report.userId) return Response.json({ message: "Use a private thread to reply to a message about your report." }, { status: 400 });
    }
    const result = await prisma.$transaction(async (tx) => {
      const message = await tx.reportMessage.create({ data: { ...(type === "lost" ? { lostItemId: id } : { foundItemId: id }), reportOwnerId: report.userId, senderId: user.id, parentMessageId, clientRequestId: input.clientRequestId, kind, body: input.body }, select: { id: true, parentMessageId: true, kind: true } });
      const threadId = message.parentMessageId ?? message.id;
      await tx.notification.create({ data: { userId: recipientId, type: kind === "HINT" ? "REPORT_HINT" : "REPORT_COMMENT", title: kind === "HINT" ? "New private hint" : "New private comment", message: kind === "HINT" ? `${user.name} sent a private hint about “${report.title}”.` : `${user.name} sent a private comment about “${report.title}”.`, reportMessageId: message.id, dedupeKey: `report-message:${message.id}` } });
      return { id: message.id, threadId };
    });
    return Response.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return Response.json({ message: "This message was already sent. Refresh the conversation." }, { status: 409 });
    return handleApiError(error);
  }
}
