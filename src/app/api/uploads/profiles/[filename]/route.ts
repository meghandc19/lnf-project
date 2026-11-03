import { prisma } from "@/lib/prisma";
import { isSupportedImageMimeType, readStoredImage } from "@/lib/uploads/images";

export const runtime = "nodejs";

const extensionMime: Record<string, string> = {
  jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", bmp: "image/bmp",
  avif: "image/avif", heic: "image/heic", heif: "image/heif",
};

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp|gif|bmp|avif|heic|heif)$/i.test(filename)) return new Response("Not found", { status: 404 });
  const mimeType = extensionMime[filename.slice(filename.lastIndexOf(".") + 1).toLowerCase()];
  if (!mimeType || !isSupportedImageMimeType(mimeType)) return new Response("Not found", { status: 404 });
  try {
    const imageUrl = `/api/uploads/profiles/${filename}`;
    const user = await prisma.user.findFirst({ where: { image: imageUrl }, select: { id: true } });
    if (!user) return new Response("Not found", { status: 404 });
    const bytes = await readStoredImage(`profiles/${filename}`);
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": mimeType,
      "Content-Length": String(bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
