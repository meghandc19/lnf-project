import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const localNetworkHosts = Object.values(networkInterfaces()).flatMap((entries) =>
  (entries ?? []).filter((entry) => entry.family === "IPv4" && !entry.internal).map((entry) => entry.address),
);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", ...localNetworkHosts],
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
      ],
    }];
  },
};

export default nextConfig;
