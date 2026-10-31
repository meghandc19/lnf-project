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
