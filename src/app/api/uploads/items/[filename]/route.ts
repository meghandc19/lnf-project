import { readFile } from "node:fs/promises";
import path from "node:path";
import { getAuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(filename)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const user = await getAuthenticatedUser();
    const storageKey = `items/${filename}`;
    const visibility = [
      { moderation: "APPROVED" as const },
      ...(user && (user.status === "ACTIVE" || user.status === "RESTRICTED") ? [{ userId: user.id }] : []),
    ];
    const reportFilter = {
      images: { some: { storageKey } },
      deletedAt: null,
      status: "ACTIVE" as const,
      OR: visibility,
    };
    const [lost, found] = await Promise.all([
      prisma.lostItem.findFirst({ where: reportFilter, select: { images: { where: { storageKey }, select: { mimeType: true } } } }),
      prisma.foundItem.findFirst({ where: reportFilter, select: { images: { where: { storageKey }, select: { mimeType: true } } } }),
    ]);
    const mimeType = lost?.images[0]?.mimeType ?? found?.images[0]?.mimeType;
    if (!mimeType || !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      return new Response("Not found", { status: 404 });
    }

    const image = await readFile(path.join(process.cwd(), ".data", "uploads", "items", filename));
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
