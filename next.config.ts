import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/store-dialogue-audio": ["./node_modules/ffmpeg-static/**/*"],
    "/api/export-movie": ["./node_modules/ffmpeg-static/**/*"],
  },
};

export default nextConfig;