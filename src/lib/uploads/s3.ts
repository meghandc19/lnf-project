import { createHash, createHmac } from "node:crypto";

function sha256(value: Uint8Array | string) { return createHash("sha256").update(value).digest("hex"); }
function hmac(key: Uint8Array | string, value: string) { return createHmac("sha256", key).update(value).digest(); }
function encodePath(value: string) { return value.split("/").map(encodeURIComponent).join("/"); }

function config() {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION;
  const accessKey = process.env.S3_ACCESS_KEY_ID;
  const secretKey = process.env.S3_SECRET_ACCESS_KEY;
  const endpoint = process.env.S3_ENDPOINT?.replace(/\/$/, "");
  if (!bucket || !region || !accessKey || !secretKey) throw new Error("S3-compatible image storage is not fully configured.");
  if (endpoint) {
    const parsedEndpoint = new URL(endpoint);
    if (parsedEndpoint.username || parsedEndpoint.password || parsedEndpoint.search || parsedEndpoint.hash || (process.env.NODE_ENV === "production" && parsedEndpoint.protocol !== "https:")) {
      throw new Error("S3-compatible endpoint configuration is invalid.");
    }
  }
  const base = endpoint ? `${endpoint}/${encodeURIComponent(bucket)}` : `https://${bucket}.s3.${region}.amazonaws.com`;
  return { bucket, region, accessKey, secretKey, base };
}

export function s3Request(method: "GET", key: string): Promise<Uint8Array>;
export function s3Request(method: "PUT", key: string, body: Uint8Array, mimeType: string): Promise<void>;
export function s3Request(method: "DELETE", key: string): Promise<void>;
export async function s3Request(method: "PUT" | "GET" | "DELETE", key: string, body?: Uint8Array, mimeType?: string): Promise<Uint8Array | void> {
  const { region, accessKey, secretKey, base } = config();
  const url = new URL(`${base}/${encodePath(key)}`);
  const now = new Date();
  const date = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const shortDate = date.slice(0, 8);
  const payloadHash = sha256(body ?? new Uint8Array());
  const headerPairs = [
    ["host", url.host],
    ...(mimeType ? [["content-type", mimeType]] : []),
    ["x-amz-content-sha256", payloadHash],
    ["x-amz-date", date],
  ].sort(([a], [b]) => a.localeCompare(b));
  const canonicalHeaders = headerPairs.map(([name, value]) => `${name}:${value}`).join("\n");
  const signedHeaders = headerPairs.map(([name]) => name).join(";");
  const canonicalRequest = [method, url.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${shortDate}/${region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${date}\n${scope}\n${sha256(canonicalRequest)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, shortDate), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const headers: Record<string, string> = {
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": date,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
  if (mimeType) headers["content-type"] = mimeType;
  const response = await fetch(url, { method, headers, ...(body ? { body: new Uint8Array(body) } : {}) });
  if (!response.ok) throw new Error(`Object storage request failed (${response.status}).`);
  if (method === "GET") return new Uint8Array(await response.arrayBuffer());
}
