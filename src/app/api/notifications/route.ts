import { z } from "zod";
import { handleApiError } from "@/lib/api/handle-error";
import { requireCanBrowse } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import type { Prisma } from "@/generated/prisma/client";

const readSchema = z.object({ id: z.string().trim().min(1).max(128) }).strict();

export async function GET() {
  try {
    const user = await requireCanBrowse();
    const where: Prisma.NotificationWhereInput = {
      userId: user.id,
      AND: [
        { OR: [
          { type: { not: "MATCH" } },
          { type: "MATCH", foundItem: { is: { deletedAt: null, status: "ACTIVE", moderation: "APPROVED" } } },
        ] },
        { OR: [
          { type: { not: "FRIEND_REPORT" } },
          { lostItem: { is: { deletedAt: null, status: "ACTIVE", moderation: "APPROVED" } } },
          { foundItem: { is: { deletedAt: null, status: "ACTIVE", moderation: "APPROVED" } } },
        ] },
        { OR: [
          { reportMessageId: null },
          { reportMessage: { is: { senderId: user.id } } },
          { reportMessage: { is: { reportOwnerId: user.id } } },
          { reportMessage: { is: { parent: { is: { senderId: user.id } } } } },
        ] },
        {
          OR: [
            { claimId: null },
            { claim: { is: { foundItem: { is: { custodianId: user.id } } } } },
            {
              claim: {
                is: {
                  conversation: {
                    is: {
                      participants: { some: { userId: user.id, deletedAt: null } },
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    };
    const [recent, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, type: true, title: true, message: true, readAt: true, createdAt: true, foundItemId: true, lostItemId: true, claimId: true, friendshipId: true, reportMessageId: true, foundItem: { select: { title: true } }, friendship: { select: { status: true, requester: { select: { username: true } } } }, reportMessage: { select: { id: true, kind: true, lostItemId: true, foundItemId: true, parentMessageId: true } } } }),
      prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    const priority = (type: string) => type === "FRIEND_REPORT" ? 0 : type === "FRIEND_REQUEST" || type === "REPORT_HINT" || type === "REPORT_COMMENT" ? 1 : 2;
    const notifications = recent.sort((a, b) => priority(a.type) - priority(b.type) || b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 20).map((notice) => notice.type === "FRIEND_REQUEST" && notice.friendship?.status === "PENDING"
      ? { ...notice, message: notice.friendship.requester.username ? `@${notice.friendship.requester.username} sent you a friend request.` : "A REVOK member sent you a friend request." }
      : notice);
    return Response.json({ notifications, unreadCount }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return handleApiError(error); }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This notification request is not allowed." }, { status: 403 });
    const user = await requireCanBrowse();
    const parsed = readSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ message: "Choose a notification to mark as read." }, { status: 400 });
    const updated = await prisma.notification.updateMany({ where: { id: parsed.data.id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
    if (!updated.count) {
      const owned = await prisma.notification.findFirst({ where: { id: parsed.data.id, userId: user.id }, select: { id: true } });
      if (!owned) return Response.json({ message: "Notification not found." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) { return handleApiError(error); }
}

export async function DELETE(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ message: "This notification request is not allowed." }, { status: 403 });
    const user = await requireCanBrowse();
    const parsed = readSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ message: "Choose a notification to delete." }, { status: 400 });
    const deleted = await prisma.notification.deleteMany({ where: { id: parsed.data.id, userId: user.id, readAt: { not: null } } });
    if (!deleted.count) {
      const owned = await prisma.notification.findFirst({ where: { id: parsed.data.id, userId: user.id }, select: { readAt: true } });
      if (!owned) return Response.json({ message: "Notification not found." }, { status: 404 });
      return Response.json({ message: "View this notification before deleting it." }, { status: 409 });
    }
    return Response.json({ ok: true });
  } catch (error) { return handleApiError(error); }
}
