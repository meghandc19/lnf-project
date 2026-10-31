export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  let originUrl: URL;
  let requestUrl: URL;
  try {
    originUrl = new URL(origin);
    requestUrl = new URL(request.url);
  } catch {
    return false;
  }

  if (originUrl.origin === requestUrl.origin) return true;
  if (originUrl.protocol !== "http:" && originUrl.protocol !== "https:") return false;

  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!host) return false;
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol ? `${forwardedProtocol}:` : requestUrl.protocol;
  if (protocol !== "http:" && protocol !== "https:") return false;

  try {
    return originUrl.origin === new URL(`${protocol}//${host}`).origin;
  } catch {
    return false;
  }
}
