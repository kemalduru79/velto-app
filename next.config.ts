import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/store-dialogue-audio": [
      "./node_modules/ffmpeg-static/ffmpeg",
    ],
    "/api/export-movie": [
      "./node_modules/ffmpeg-static/ffmpeg",
    ],
  },
};

export default nextConfig;