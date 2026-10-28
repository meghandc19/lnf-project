import assert from "node:assert/strict";
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
      assert.match(request.headers.authorization ?? "", /^AWS4-HMAC-SHA256 Credential=test-access-key\//);
      const contentHash = request.headers["x-amz-content-sha256"];
      assert.match(Array.isArray(contentHash) ? contentHash[0] ?? "" : contentHash ?? "", /^[a-f0-9]{64}$/);
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
});
