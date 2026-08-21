import type { NextConfig } from "next";

const executableExtension = process.platform === "win32" ? ".exe" : "";
const ffmpegExecutable = `./node_modules/ffmpeg-static/ffmpeg${executableExtension}`;
const ffprobeExecutable = `./node_modules/ffprobe-static/bin/${process.platform}/${process.arch}/ffprobe${executableExtension}`;

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
  outputFileTracingIncludes: {
    "/api/store-dialogue-audio": ["./node_modules/ffmpeg-static/**/*"],
    "/api/export-movie": ["./node_modules/ffmpeg-static/**/*"],
    "/api/stitch-video": [
      ffmpegExecutable,
      "./node_modules/ffprobe-static/index.js",
      "./node_modules/ffprobe-static/package.json",
      ffprobeExecutable,
    ],
  },
};

export default nextConfig;
