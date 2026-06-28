import { NextRequest, NextResponse } from "next/server";
import RunwayML from "@runwayml/sdk";
import { normalizeRunwayClipDuration, normalizeVideoQualityTier } from "../../../lib/video/timelineSync";

export const runtime = "nodejs";

type RunwayVideoModel = "gen4_turbo" | "gen4.5" | "seedance2";

type Gen4Ratio =
  | "1280:720"
  | "720:1280"
  | "1104:832"
  | "960:960"
  | "832:1104"
  | "1584:672";

type Seedance2Ratio =
  | "1280:720"
  | "720:1280"
  | "960:960"
  | "992:432"
  | "864:496"
  | "752:560"
  | "640:640"
  | "560:752"
  | "496:864"
  | "1470:630"
  | "1112:834"
  | "834:1112";

function getClient() {
  const apiKey = process.env.RUNWAY_API_KEY;

  if (!apiKey) {
    throw new Error("RUNWAY_API_KEY is missing");
  }

  return new RunwayML({
    apiKey,
  });
}

function getModel(): RunwayVideoModel {
  const model = process.env.RUNWAY_VIDEO_MODEL?.trim();

  if (model === "gen4_turbo" || model === "gen4.5" || model === "seedance2") {
    return model;
  }

  return "gen4_turbo";
}

function getGen4Ratio(value: unknown): Gen4Ratio {
  if (value === "720:1280") return "720:1280";
  if (value === "1104:832") return "1104:832";
  if (value === "960:960") return "960:960";
  if (value === "832:1104") return "832:1104";
  if (value === "1584:672") return "1584:672";

  return "1280:720";
}

function getSeedance2Ratio(value: unknown): Seedance2Ratio {
  if (value === "720:1280") return "720:1280";
  if (value === "960:960") return "960:960";
  if (value === "992:432") return "992:432";
  if (value === "864:496") return "864:496";
  if (value === "752:560") return "752:560";
  if (value === "640:640") return "640:640";
  if (value === "560:752") return "560:752";
  if (value === "496:864") return "496:864";
  if (value === "1470:630") return "1470:630";
  if (value === "1112:834") return "1112:834";
  if (value === "834:1112") return "834:1112";

  return "1280:720";
}

function buildPrompt({
  text,
  motionHint,
  cameraDirection,
  emotion,
}: {
  text?: string;
  motionHint?: string;
  cameraDirection?: string;
  emotion?: string;
}) {
  const parts = [
    "Create a short cinematic animated video from the provided image.",
    text ? `Scene description: ${text}` : "",
    motionHint ? `Motion: ${motionHint}` : "",
    cameraDirection ? `Camera: ${cameraDirection}` : "",
    emotion ? `Emotion: ${emotion}` : "",
    "Keep the scene coherent, child-friendly, and visually smooth.",
  ].filter(Boolean);

  return parts.join(" ");
}

function isHttpsAssetUrl(value: string) {
  return value.startsWith("https://");
}

function isImageDataUri(value: string) {
  return /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value);
}

async function checkUrlAccessible(url: string) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

function validateImageInput(imageUrl: unknown) {
  if (!imageUrl || typeof imageUrl !== "string") {
    return "imageUrl is required";
  }

  if (isHttpsAssetUrl(imageUrl)) {
    return null;
  }

  if (isImageDataUri(imageUrl)) {
    return null;
  }

  return "imageUrl must be either a public HTTPS URL or a base64 data:image URI accessible by Runway";
}

async function createVideoTask({
  client,
  model,
  imageUrl,
  promptText,
  requestedRatio,
  duration,
}: {
  client: RunwayML;
  model: RunwayVideoModel;
  imageUrl: string;
  promptText: string;
  requestedRatio: unknown;
  duration: number;
}) {
  if (model === "gen4_turbo") {
    const ratio = getGen4Ratio(requestedRatio);

    return client.imageToVideo.create({
      model: "gen4_turbo",
      promptImage: imageUrl,
      promptText,
      ratio,
      duration,
    });
  }

  if (model === "gen4.5") {
    const ratio = getGen4Ratio(requestedRatio);

    return client.imageToVideo.create({
      model: "gen4.5",
      promptImage: imageUrl,
      promptText,
      ratio,
      duration,
    });
  }

  const ratio = getSeedance2Ratio(requestedRatio);

  return client.imageToVideo.create({
    model: "seedance2",
    promptImage: imageUrl,
    promptText,
    ratio,
    duration,
  });
}

function normalizeTask(task: any) {
  const status = typeof task?.status === "string" ? task.status.toUpperCase() : "UNKNOWN";
  const output = Array.isArray(task?.output) ? task.output : [];

  let videoUrl: string | null = null;

  if (typeof output[0] === "string") {
    videoUrl = output[0];
  } else if (output[0] && typeof output[0]?.url === "string") {
    videoUrl = output[0].url;
  }

  return {
    id: task?.id ?? null,
    status,
    failureCode: task?.failureCode ?? null,
    failureMessage: task?.failureMessage ?? null,
    videoUrl,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const imageUrl = body?.imageUrl;
    const text = body?.text ?? "";
    const motionHint = body?.motionHint ?? "";
    const cameraDirection = body?.cameraDirection ?? "";
    const emotion = body?.emotion ?? "";

    const model = getModel();
    const qualityTier = normalizeVideoQualityTier(body?.qualityMode, "standard");
    const durationPolicy = normalizeRunwayClipDuration(body?.duration, qualityTier);
    const duration = durationPolicy.durationSec;
    const requestedRatio = body?.ratio || body?.requestedRatio || "960:960";

    const imageValidationError = validateImageInput(imageUrl);
    if (!imageValidationError && typeof imageUrl === "string" && imageUrl.startsWith("https://")) {
      const ok = await checkUrlAccessible(imageUrl);
      if (!ok) {
        return NextResponse.json(
          { ok: false, error: "imageUrl not accessible by Runway (HEAD failed)", imageUrl },
          { status: 400 }
        );
      }
    }
    if (imageValidationError) {
      return NextResponse.json(
        { ok: false, error: imageValidationError },
        { status: 400 }
      );
    }

    const promptText = buildPrompt({
      text,
      motionHint,
      cameraDirection,
      emotion,
    });

    const client = getClient();

    const task = await createVideoTask({
      client,
      model,
      imageUrl,
      promptText,
      requestedRatio,
      duration,
    });

    return NextResponse.json({
      ok: true,
      taskId: task.id,
      status: "PENDING",
      model,
      duration,
      durationPolicy,
      requestedRatio,
      promptText,
      debug: { imageUrl }
    });
  } catch (error: any) {
    console.error("Runway video create error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to create Runway video task",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { ok: false, error: "taskId is required" },
        { status: 400 }
      );
    }

    const client = getClient();
    const task = await client.tasks.retrieve(taskId);
    const normalized = normalizeTask(task);
    const debugTask = task as any;

    return NextResponse.json({
      ok: true,
      ...normalized,
      debug: {
        rawStatus: debugTask?.status ?? null,
        createdAt: debugTask?.createdAt ?? null,
        failureCode: debugTask?.failureCode ?? null,
        failureMessage: debugTask?.failureMessage ?? null,
        rawTask: debugTask,
      },
    });
  } catch (error: any) {
    console.error("Runway video status error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to retrieve Runway task",
      },
      { status: 500 }
    );
  }
}