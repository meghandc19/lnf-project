import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function encryptionKey() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("BETTER_AUTH_SECRET must be configured to protect recovery codes.");
  return createHash("sha256").update(secret).digest();
}

export function hashRecoveryCode(code: string) {
  return createHash("sha256").update(code.toUpperCase()).digest("hex");
}

export function encryptRecoveryCode(code: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return { recoveryCodeCiphertext: ciphertext.toString("base64"), recoveryCodeIv: iv.toString("base64"), recoveryCodeTag: cipher.getAuthTag().toString("base64") };
}

export function decryptRecoveryCode(ciphertext: string, iv: string, tag: string) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}
