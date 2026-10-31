import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const localNetworkHosts = Object.values(networkInterfaces()).flatMap((entries) =>
  (entries ?? []).filter((entry) => entry.family === "IPv4" && !entry.internal).map((entry) => entry.address),
);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", ...localNetworkHosts],
};

export default nextConfig;
