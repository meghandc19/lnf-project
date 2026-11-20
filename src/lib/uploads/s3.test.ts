import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { s3Request } from "./s3.ts";

test("S3-compatible adapter signs requests and uploads, reads, and deletes objects", async (t) => {
  const original = { endpoint: process.env.S3_ENDPOINT, bucket: process.env.S3_BUCKET, region: process.env.S3_REGION, accessKey: process.env.S3_ACCESS_KEY_ID, secretKey: process.env.S3_SECRET_ACCESS_KEY };
  const stored = new Map<string, Buffer>();
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const key = String(request.url ?? "");
      const method: string = request.method as unknown as string;
      const contentHash = request.headers["x-amz-content-sha256"];
      const payloadHash = createHash("sha256").update(Buffer.concat(chunks)).digest("hex");
      const contentHashValue = Array.isArray(contentHash) ? contentHash[0] ?? "" : contentHash ?? "";
      assert.equal(contentHashValue, payloadHash);
      const date = String(request.headers["x-amz-date"] ?? "");
      const shortDate = date.slice(0, 8);
      const canonicalHeaderPairs = [
        ["host", String(request.headers.host ?? "")],
        ...(request.headers["content-type"] ? [["content-type", String(request.headers["content-type"])]] : []),
        ["x-amz-content-sha256", contentHashValue],
        ["x-amz-date", date],
      ].sort(([a], [b]) => a.localeCompare(b));
      const canonicalHeaders = `${canonicalHeaderPairs.map(([name, value]) => `${name}:${value}`).join("\n")}\n`;
      const signedHeaders = canonicalHeaderPairs.map(([name]) => name).join(";");
      const scope = `${shortDate}/auto/s3/aws4_request`;
      const canonicalRequest = [method, key, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
      const digest = (value: string) => createHash("sha256").update(value).digest("hex");
      const sign = (secret: Buffer | string, value: string) => createHmac("sha256", secret).update(value).digest();
      const signingKey = sign(sign(sign(sign("AWS4test-secret-key", shortDate), "auto"), "s3"), "aws4_request");
      const stringToSign = `AWS4-HMAC-SHA256\n${date}\n${scope}\n${digest(canonicalRequest)}`;
      const expectedSignature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
      assert.equal(request.headers.authorization, `AWS4-HMAC-SHA256 Credential=test-access-key/${scope}, SignedHeaders=${signedHeaders}, Signature=${expectedSignature}`);
      if (key.endsWith("/denied")) {
        response.writeHead(403, { "Content-Type": "application/xml" }).end("<Error><Code>AccessDenied</Code><RequestId>test-request-id</RequestId></Error>");
        return;
      }
      if (method === "PUT") { stored.set(key, Buffer.concat(chunks)); response.writeHead(200).end(); }
      else if (method === "GET") { response.writeHead(stored.has(key) ? 200 : 404).end(stored.get(key)); }
      else if (method === "DELETE") { stored.delete(key); response.writeHead(204).end(); }
      else response.writeHead(405).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  process.env.S3_ENDPOINT = `http://127.0.0.1:${address.port}`;
  process.env.S3_BUCKET = "test-bucket";
  process.env.S3_REGION = "auto";
  process.env.S3_ACCESS_KEY_ID = "test-access-key";
  process.env.S3_SECRET_ACCESS_KEY = "test-secret-key";
  t.after(async () => {
    server.close();
    for (const [name, value] of Object.entries({ S3_ENDPOINT: original.endpoint, S3_BUCKET: original.bucket, S3_REGION: original.region, S3_ACCESS_KEY_ID: original.accessKey, S3_SECRET_ACCESS_KEY: original.secretKey })) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });

  const bytes = new Uint8Array([1, 2, 3, 4]);
  await s3Request("PUT", "items/demo.jpg", bytes, "image/jpeg");
  assert.deepEqual(await s3Request("GET", "items/demo.jpg"), bytes);
  await s3Request("DELETE", "items/demo.jpg");
  await assert.rejects(s3Request("GET", "items/demo.jpg"), /Object storage request failed \(404\)/);
  await assert.rejects(s3Request("GET", "items/denied"), /Object storage request failed \(403: AccessDenied, request test-request-id\)/);
});
