import { getAuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { readStoredImage } from "@/lib/uploads/images";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(filename)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const user = await getAuthenticatedUser();
    if (user?.status === "BANNED" || user?.status === "DELETED") return new Response("Not found", { status: 404 });
    const storageKey = `items/${filename}`;
    const reportFilter = {
      images: { some: { storageKey } },
      deletedAt: null,
      OR: [
        { status: "ACTIVE" as const, moderation: "APPROVED" as const },
        ...(user && (user.status === "ACTIVE" || user.status === "RESTRICTED") ? [{ userId: user.id }] : []),
        ...(user?.status === "ACTIVE" && (user.role === "ADMIN" || user.role === "SUPER_ADMIN") ? [{ moderation: { in: ["PENDING", "FLAGGED", "BLOCKED"] as ("PENDING" | "FLAGGED" | "BLOCKED")[] } }] : []),
      ],
    };
    const [lost, found] = await Promise.all([
      prisma.lostItem.findFirst({ where: reportFilter, select: { images: { where: { storageKey }, select: { mimeType: true } } } }),
      prisma.foundItem.findFirst({ where: reportFilter, select: { images: { where: { storageKey }, select: { mimeType: true } } } }),
    ]);
    const mimeType = lost?.images[0]?.mimeType ?? found?.images[0]?.mimeType;
    if (!mimeType || !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      return new Response("Not found", { status: 404 });
    }

    const image = await readStoredImage(storageKey);
    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(image.byteLength),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
