import type { NextRequest } from "next/server";
import { handleStitchVideoRequest } from "../../../lib/video/stitching/stitchVideoService.server";

export async function POST(req: NextRequest) {
  return handleStitchVideoRequest(req);
}
