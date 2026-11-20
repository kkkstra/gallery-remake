import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  devIndicators: false,
  images: {
    formats: ["image/avif", "image/webp"],
    imageSizes: [64, 96, 128, 256, 384],
    deviceSizes: [640, 828, 1080, 1200, 1920, 2048, 3840],
    qualities: [75, 85],
    minimumCacheTTL: 2592000,
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
