import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/store-dialogue-audio": ["./node_modules/ffmpeg-static/**/*"],
    "/api/export-movie": ["./node_modules/ffmpeg-static/**/*"],
    "/api/stitch-video": [
      "./node_modules/ffmpeg-static/**/*",
      "./node_modules/ffprobe-static/**/*",
    ],
  },
};

export default nextConfig;
