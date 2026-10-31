import assert from "node:assert/strict";
import test from "node:test";
import { isSameOriginRequest } from "./same-origin.ts";

test("same-origin validation accepts the request URL origin", () => {
  const request = new Request("http://localhost:3000/api/items", { headers: { origin: "http://localhost:3000" } });
  assert.equal(isSameOriginRequest(request), true);
});

test("same-origin validation accepts the browser host on a LAN dev server", () => {
  const request = new Request("http://0.0.0.0:3000/api/items", {
    headers: { origin: "http://192.168.1.20:3000", host: "192.168.1.20:3000" },
  });
  assert.equal(isSameOriginRequest(request), true);
});

test("same-origin validation respects a forwarded HTTPS scheme", () => {
  const request = new Request("http://internal/api/items", {
    headers: { origin: "https://revok.example", host: "revok.example", "x-forwarded-proto": "https" },
  });
  assert.equal(isSameOriginRequest(request), true);
});

test("same-origin validation rejects an unrelated origin and a missing origin", () => {
  const crossOrigin = new Request("http://localhost:3000/api/items", { headers: { origin: "https://attacker.example" } });
  const missing = new Request("http://localhost:3000/api/items");
  assert.equal(isSameOriginRequest(crossOrigin), false);
  assert.equal(isSameOriginRequest(missing), false);
});
