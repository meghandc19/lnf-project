import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const IMAGE_LIMITS = {
  profile: 8 * 1024 * 1024,
  item: 5 * 1024 * 1024,
} as const;

const formats = {
  "image/jpeg": { extension: ".jpg", matches: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: ".png", matches: (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 },
  "image/webp": { extension: ".webp", matches: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" },
} as const;

export type ImageMimeType = keyof typeof formats;

export async function validateImage(file: File, maxBytes: number) {
  if (file.size <= 0 || file.size > maxBytes || !Object.prototype.hasOwnProperty.call(formats, file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image within the size limit.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = formats[file.type as ImageMimeType];
  if (bytes.byteLength !== file.size || !format.matches(bytes)) {
    throw new Error("The selected file is not a valid image of the declared type.");
  }
  return { bytes, mimeType: file.type as ImageMimeType, extension: format.extension };
}

export async function storeImage(scope: "profiles" | "items", file: File, maxBytes: number) {
  const { bytes, mimeType, extension } = await validateImage(file, maxBytes);
  const filename = `${randomUUID()}${extension}`;
  const directory = scope === "profiles"
    ? path.join(process.cwd(), "public", "uploads", "profiles")
    : path.join(process.cwd(), ".data", "uploads", "items");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(/*turbopackIgnore: true*/ directory, filename), bytes, { flag: "wx" });
  return {
    url: scope === "profiles" ? `/uploads/profiles/${filename}` : `/api/uploads/items/${filename}`,
    storageKey: `${scope}/${filename}`,
    mimeType,
    sizeBytes: bytes.byteLength,
  };
}

export async function removeStoredImage(storageKey: string) {
  if (!/^(profiles|items)\/[a-f0-9-]+\.(jpg|png|webp)$/i.test(storageKey)) return;
  const [scope, filename] = storageKey.split("/");
  const filePath = scope === "profiles"
    ? path.join(process.cwd(), "public", "uploads", "profiles", filename)
    : path.join(process.cwd(), ".data", "uploads", "items", filename);
  try {
    await unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
