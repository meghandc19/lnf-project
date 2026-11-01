import assert from "node:assert/strict";
import test from "node:test";
import { IMAGE_LIMITS, isAllowedFoundItemPhotoSize, validateImage } from "./images.ts";

test("found item photo limit is strictly below 4 MiB", () => {
  assert.equal(IMAGE_LIMITS.foundItem, 4 * 1024 * 1024);
  assert.equal(isAllowedFoundItemPhotoSize(IMAGE_LIMITS.foundItem - 1), true);
  assert.equal(isAllowedFoundItemPhotoSize(IMAGE_LIMITS.foundItem), false);
  assert.equal(isAllowedFoundItemPhotoSize(0), false);
});

test("small JPGs with a generic phone MIME type are accepted", async () => {
  const smallJpg = new File([Uint8Array.of(0xff, 0xd8, 0xff)], "tiny.jpg", { type: "application/octet-stream" });
  const result = await validateImage(smallJpg, IMAGE_LIMITS.lostItem);
  assert.equal(result.mimeType, "image/jpeg");
  assert.equal(result.bytes.byteLength, 3);
});

test("lost item image limit is 3 MiB inclusive", async () => {
  assert.equal(IMAGE_LIMITS.lostItem, 3 * 1024 * 1024);
  const exactLimitBytes = new Uint8Array(IMAGE_LIMITS.lostItem);
  exactLimitBytes.set([0xff, 0xd8, 0xff]);
  const exactLimit = new File([exactLimitBytes], "photo.jpg", { type: "image/jpeg" });
  assert.equal((await validateImage(exactLimit, IMAGE_LIMITS.lostItem)).bytes.byteLength, IMAGE_LIMITS.lostItem);
  const tooLarge = new File([new Uint8Array(IMAGE_LIMITS.lostItem + 1)], "photo.jpg", { type: "image/jpeg" });
  await assert.rejects(validateImage(tooLarge, IMAGE_LIMITS.lostItem), /3 MB or smaller/);
});

test("profile photos use a 3 MiB inclusive limit", async () => {
  assert.equal(IMAGE_LIMITS.profile, 3 * 1024 * 1024);
  const exactLimitBytes = new Uint8Array(IMAGE_LIMITS.profile);
  exactLimitBytes.set([0xff, 0xd8, 0xff]);
  const exactLimit = new File([exactLimitBytes], "avatar.jpg", { type: "image/jpeg" });
  assert.equal((await validateImage(exactLimit, IMAGE_LIMITS.profile)).bytes.byteLength, IMAGE_LIMITS.profile);
});

test("small browser-friendly raster formats are accepted by signature", async () => {
  const formats = [
    { mime: "image/gif", name: "small.gif", header: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] },
    { mime: "image/bmp", name: "small.bmp", header: [0x42, 0x4d] },
    { mime: "image/avif", name: "small.avif", header: [0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66] },
  ];
  for (const format of formats) {
    const file = new File([Uint8Array.from(format.header)], format.name, { type: format.mime });
    const result = await validateImage(file, IMAGE_LIMITS.profile);
    assert.equal(result.mimeType, format.mime);
  }
});

test("SVG is rejected instead of being stored as an active image", async () => {
  const svg = new File(["<svg xmlns='http://www.w3.org/2000/svg'></svg>"], "image.svg", { type: "image/svg+xml" });
  await assert.rejects(validateImage(svg, IMAGE_LIMITS.profile), /supported image format/);
});
