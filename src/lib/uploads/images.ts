import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { s3Request } from "@/lib/uploads/s3";

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

function storageDriver() {
  const driver = process.env.UPLOAD_STORAGE?.trim().toLowerCase();
  if (process.env.NODE_ENV === "production" && driver !== "s3") throw new Error("Production requires S3-compatible image storage.");
  if (!driver || driver === "filesystem") return "filesystem" as const;
  if (driver === "s3") return "s3" as const;
  throw new Error("Unsupported image storage configuration.");
}
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
  const driver = scope === "items" ? storageDriver() : "filesystem";
  const storageKey = `${scope}/${filename}`;
  if (driver === "s3") {
    await s3Request("PUT", storageKey, bytes, mimeType);
    return { url: `/api/uploads/items/${filename}`, storageKey, mimeType, sizeBytes: bytes.byteLength };
  }
  const directory = scope === "profiles"
    ? path.join(process.cwd(), "public", "uploads", "profiles")
    : path.join(process.cwd(), ".data", "uploads", "items");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(/*turbopackIgnore: true*/ directory, filename), bytes, { flag: "wx" });
  return {
    url: scope === "profiles" ? `/uploads/profiles/${filename}` : `/api/uploads/items/${filename}`,
    storageKey,
    mimeType,
    sizeBytes: bytes.byteLength,
  };
}

export async function removeStoredImage(storageKey: string) {
  if (!/^(profiles|items)\/[a-f0-9-]+\.(jpg|png|webp)$/i.test(storageKey)) return;
  const [scope, filename] = storageKey.split("/");
  if (scope === "items" && storageDriver() === "s3") {
    await s3Request("DELETE", storageKey);
    return;
  }
  const filePath = scope === "profiles"
    ? path.join(process.cwd(), "public", "uploads", "profiles", filename)
    : path.join(process.cwd(), ".data", "uploads", "items", filename);
  try {
    await unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function readStoredImage(storageKey: string) {
  if (!/^items\/[a-f0-9-]+\.(jpg|png|webp)$/i.test(storageKey)) throw new Error("Invalid image key.");
  if (storageDriver() === "s3") {
    return await s3Request("GET", storageKey);
  }
  return new Uint8Array(await readFile(path.join(process.cwd(), ".data", "uploads", "items", storageKey.split("/")[1])));
}
