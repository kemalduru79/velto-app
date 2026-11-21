import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";
import { getVideoProvider } from "@/lib/video/providers";
import {
  isValidQueueJobId,
  validatePersistedVideoJobBinding,
} from "@/lib/security/persistedVideoJobBinding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };
const FORBIDDEN_HEADERS = ["x-task-id", "x-native-task-id", "x-provider", "x-provider-url"];

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const principal = await authenticateRequest(req);
    const { jobId } = await context.params;
    if (!isValidQueueJobId(jobId)) return json({ ok: false, error: "Job identifier is invalid." }, 400);
    if (
      req.nextUrl.search ||
      Number(req.headers.get("content-length") || 0) > 0 ||
      FORBIDDEN_HEADERS.some((name) => req.headers.has(name))
    ) {
      return json({ ok: false, error: "Provider task input is not accepted." }, 400);
    }
    const job = await getPersistenceServices().jobQueue.getForUser(jobId, principal.id);
    if (!job) return json({ ok: false, error: "Job was not found." }, 404);
    if (
      job.jobType !== "video_reconcile" ||
      job.status !== "succeeded" ||
      job.result?.outputReady !== true
    ) {
      return json({ ok: false, error: "Video output is not ready." }, 409);
    }
    const binding = validatePersistedVideoJobBinding(job);
    if (!binding) return json({ ok: false, error: "The persisted video job binding is invalid." }, 409);

    const provider = getVideoProvider(binding.provider);
    const task = await provider.retrieveTask(binding.nativeTaskId);
    if (task.status !== "SUCCEEDED" || !task.videoUrl) {
      return json({ ok: false, error: "Video output is not ready." }, 409);
    }
    const output = await provider.downloadOutput(task.videoUrl);
    if (!output.ok || !output.body) return json({ ok: false, error: "Video output could not be streamed." }, 502);
    const headers = new Headers(PRIVATE_HEADERS);
    headers.set("Content-Type", output.headers.get("content-type") || "video/mp4");
    const contentLength = output.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);
    return new NextResponse(output.body, { status: 200, headers });
  } catch (error) {
    if (error instanceof AuthenticationError) return json({ ok: false, error: "Authentication required." }, 401);
    console.error("job output route failed");
    return json({ ok: false, error: "Video output request failed." }, 500);
  }
}
