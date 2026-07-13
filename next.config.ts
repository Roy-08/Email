import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // Increase the body size limit for API routes (App Router route handlers)
  serverExternalPackages: ["googleapis", "nodemailer"],
};

export default nextConfig;
