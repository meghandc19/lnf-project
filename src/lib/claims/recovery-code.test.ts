import assert from "node:assert/strict";
import test from "node:test";
import { decryptRecoveryCode, encryptRecoveryCode, hashRecoveryCode } from "./recovery-code.ts";

test("recovery code encryption can be opened only with the application secret", () => {
  process.env.BETTER_AUTH_SECRET = "unit-test-secret-with-enough-entropy-to-derive-a-key";
  const code = "A1B2C3D4E5F60718";
  const encrypted = encryptRecoveryCode(code);
  assert.notEqual(encrypted.recoveryCodeCiphertext, code);
  assert.equal(decryptRecoveryCode(encrypted.recoveryCodeCiphertext, encrypted.recoveryCodeIv, encrypted.recoveryCodeTag), code);
  assert.equal(hashRecoveryCode(code), hashRecoveryCode(code.toLowerCase()));
  assert.throws(() => decryptRecoveryCode(encrypted.recoveryCodeCiphertext, encrypted.recoveryCodeIv, "AAAAAAAAAAAAAAAAAAAAAA=="));
});
