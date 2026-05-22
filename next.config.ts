import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a standalone build — smaller Docker image, self-contained server.js
  output: "standalone",
};

export default nextConfig;
