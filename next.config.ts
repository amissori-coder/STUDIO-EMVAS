import type { NextConfig } from "next";

// Con src/proxy.ts presente Next bufferizza il body delle richieste fino a questo limite (default 10 MB):
// deve coprire un caricamento completo di documenti (MAX_FILES_PER_UPLOAD file da MAX_UPLOAD_MB).
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? 25) || 25;
const proxyBodyMb = Math.ceil(10 * maxUploadMb * 1.05) + 5;

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs", "web-push", "nodemailer", "node-cron"],
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
    },
    proxyClientMaxBodySize: `${proxyBodyMb}mb`,
  },
};

export default nextConfig;
