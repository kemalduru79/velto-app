import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import fsSync from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import {
  applyTimelineSyncPlanToScenes,
  type TimelineSyncPlan,
} from "../timelineSync";
import {
  alignDurationToFrameGrid,
  type StitchContinuityCheck,
} from "../stitchContinuity";
import type { ExportFlowValidationReport } from "../exportFlowValidation";
import {
  createSceneAudioClip,
  createSceneVideoBase,
  DEFAULT_UNMEASURED_SCENE_DURATION_SECONDS,
  getSceneRequestedDuration,
  getSceneVisualAction,
  MAX_AUDIO_SAFE_SCENE_DURATION_SECONDS,
  muxSceneVideoAndAudio,
  roundDuration,
  safeDuration,
  SPEECH_TAIL_BUFFER_SECONDS,
  stitchSceneClips,
  type StitchSceneInput,
  verifyRenderedContinuity,
} from "./nativeMedia.server";

export async function handleStitchVideoRequest(req: NextRequest) {
  const tempDir = path.join(os.tmpdir(), `velto-stitch-${crypto.randomUUID()}`);

  try {
    const body = await req.json();
    const exportFlowValidation = body?.exportFlowValidation as
      | ExportFlowValidationReport
      | undefined;

    if (exportFlowValidation?.version === "3N-5") {
      if (!exportFlowValidation.canExport) {
        return NextResponse.json(
          {
            ok: false,
            error: `Export blocked by continuity preflight for scene(s): ${exportFlowValidation.blockingSceneIds.join(", ")}.`,
            exportFlowValidation,
          },
          { status: 409 },
        );
      }

      if (
        exportFlowValidation.requiresManualConfirmation &&
        body?.manualConfirmationGranted !== true
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Export requires manual confirmation before stitching.",
            exportFlowValidation,
          },
          { status: 409 },
        );
      }
    }

    const rawScenes: StitchSceneInput[] = Array.isArray(body?.scenes)
      ? body.scenes
      : Array.isArray(body?.videoUrls)
        ? body.videoUrls.map((videoUrl: string, index: number) => ({
            id: index + 1,
            videoUrl,
          }))
        : [];

    const filteredScenes = rawScenes.filter(
      (scene) => Boolean(scene?.videoUrl) || Boolean(scene?.imageUrl),
    );
    const timelineSyncPlan = body?.timelineSyncPlan as
      TimelineSyncPlan | undefined;
    const scenes = applyTimelineSyncPlanToScenes(
      filteredScenes,
      timelineSyncPlan,
      {
        fallbackDuration: DEFAULT_UNMEASURED_SCENE_DURATION_SECONDS,
        minDuration: 3,
        maxDuration: MAX_AUDIO_SAFE_SCENE_DURATION_SECONDS,
        tailBufferSeconds: SPEECH_TAIL_BUFFER_SECONDS,
      },
    );

    const timelineVisualActionCount = scenes.reduce<Record<string, number>>(
      (acc, scene) => {
        const action = getSceneVisualAction(scene) || "none";
        acc[action] = (acc[action] || 0) + 1;
        return acc;
      },
      {},
    );
    const audioMismatchSceneCount = scenes.filter((scene) =>
      ["long", "critical"].includes(
        String(
          scene?.timelineDecision?.audioMismatch ||
            scene?.timing?.audioMismatch ||
            "",
        ),
      ),
    ).length;

    if (scenes.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No scenes with videoUrl or imageUrl provided" },
        { status: 400 },
      );
    }

    await fs.mkdir(tempDir, { recursive: true });

    const finalSceneClipPaths: string[] = [];
    const finalSceneDurationsSec: number[] = [];
    const sceneContinuityChecks: StitchContinuityCheck[] = [];
    let matchedDurationSceneCount = 0;
    let splitRecommendedSceneCount = 0;
    let unnecessaryExtensionRemovedSec = 0;
    let visualFillerSceneCount = 0;
    let visualFillerDurationSec = 0;
    const visualFillerStrategyCount: Record<string, number> = {};

    for (let i = 0; i < scenes.length; i += 1) {
      const scene = scenes[i];
      const requestedDurationSec = getSceneRequestedDuration(scene);
      const audioResult = await createSceneAudioClip(
        scene,
        tempDir,
        i,
        requestedDurationSec,
      );
      const durationSec = alignDurationToFrameGrid(
        safeDuration(audioResult.durationSec),
      );

      if (audioResult.durationMatch.status !== "unmeasured") {
        matchedDurationSceneCount += 1;
      }
      if (audioResult.durationMatch.splitRecommended) {
        splitRecommendedSceneCount += 1;
      }
      unnecessaryExtensionRemovedSec +=
        audioResult.durationMatch.unnecessaryExtensionRemovedSec;

      const videoResult = await createSceneVideoBase(
        scene,
        tempDir,
        i,
        durationSec,
      );
      const fillerStrategy = videoResult.fillerPlan.strategy;

      if (videoResult.fillerPlan.requiresFiller) {
        visualFillerSceneCount += 1;
        visualFillerDurationSec += videoResult.fillerPlan.fillerDurationSec;
      }
      visualFillerStrategyCount[fillerStrategy] =
        (visualFillerStrategyCount[fillerStrategy] || 0) + 1;
      const finalScenePath = path.join(tempDir, `scene_${i}_final.mp4`);

      await muxSceneVideoAndAudio(
        videoResult.videoPath,
        audioResult.audioPath,
        finalScenePath,
        durationSec,
      );

      const continuityCheck = await verifyRenderedContinuity(
        finalScenePath,
        durationSec,
        `Scene ${scene.id ?? i + 1}`,
      );

      finalSceneClipPaths.push(finalScenePath);
      finalSceneDurationsSec.push(durationSec);
      sceneContinuityChecks.push(continuityCheck);
    }

    const outputPath = path.join(tempDir, "final-video.mp4");
    const expectedFinalDurationSec = roundDuration(
      finalSceneDurationsSec.reduce((sum, duration) => sum + duration, 0),
    );

    await stitchSceneClips(
      finalSceneClipPaths,
      finalSceneDurationsSec,
      outputPath,
    );
    const finalContinuityCheck = await verifyRenderedContinuity(
      outputPath,
      expectedFinalDurationSec,
      "Final video",
    );
    const maxSceneAudioVideoDriftSec = Math.max(
      0,
      ...sceneContinuityChecks.map((check) => check.audioVideoDriftSec),
    );

    const videoBuffer = await fs.readFile(outputPath);

    return new NextResponse(videoBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="velto-final-video.mp4"`,
        "X-Scene-Count": String(scenes.length),
        "X-Timeline-Aware": timelineSyncPlan ? "true" : "false",
        "X-Audio-Safe-Stitch": "true",
        "X-Audio-Duration-Matched": String(matchedDurationSceneCount),
        "X-Audio-Mismatch-Scenes": String(audioMismatchSceneCount),
        "X-Split-Recommended-Scenes": String(splitRecommendedSceneCount),
        "X-Unnecessary-Extension-Removed": String(
          roundDuration(unnecessaryExtensionRemovedSec),
        ),
        "X-Visual-Filler-Scenes": String(visualFillerSceneCount),
        "X-Visual-Filler-Duration": String(
          roundDuration(visualFillerDurationSec),
        ),
        "X-Visual-Filler-Strategies": JSON.stringify(
          visualFillerStrategyCount,
        ),
        "X-Freeze-Frame-Fallback": "disabled",
        "X-Stitch-Continuity": "verified",
        "X-Export-Preflight": exportFlowValidation?.status || "not-provided",
        "X-Export-Auto-Fixes": String(
          exportFlowValidation?.autoFixedScenes || 0,
        ),
        "X-Clip-Trim": "frame-aligned",
        "X-Transition-Mode": "normalized-cut",
        "X-Scene-Gap-Removal": "enabled",
        "X-Black-Frame-Guard": "timestamp-normalized",
        "X-Expected-Duration": String(expectedFinalDurationSec),
        "X-Final-Duration": String(finalContinuityCheck.actualDurationSec),
        "X-Final-AV-Drift": String(
          finalContinuityCheck.audioVideoDriftSec,
        ),
        "X-Max-Scene-AV-Drift": String(maxSceneAudioVideoDriftSec),
        "X-Timeline-Visual-Actions": JSON.stringify(timelineVisualActionCount),
      },
    });
  } catch (err: unknown) {
    console.error("SCENE COMPOSER ERROR:", err);

    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Final video could not be composed.",
      },
      { status: 500 },
    );
  } finally {
    try {
      if (fsSync.existsSync(tempDir)) {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.error("SCENE COMPOSER CLEANUP ERROR:", cleanupError);
    }
  }
}
