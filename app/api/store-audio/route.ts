import { withObservedApiRoute } from "@/lib/observability";
import { NextRequest, NextResponse } from "next/server";
import {
  getCreatorRoutedVoiceSettings,
  getCreatorVoiceRoute,
} from "@/lib/creator/voiceRouting";
import { getMediaProviderFacade, getProviderPublicMessage } from "@/lib/providers";
import {
  getCreatorVoiceProfileServerSelection,
  resolveCreatorVoiceProfileVoiceId,
} from "@/lib/providers/voice/voiceProfileResolver";
import { getPersistenceServices, registerStoredAssetOrThrow } from "@/lib/persistence";
import { authenticateRequest } from "@/lib/auth/server";
import {
  getCreditErrorResponse,
  releaseMeteredOperation,
  reserveMeteredOperation,
  settleMeteredOperation,
  type MeteredOperationReservation,
} from "@/lib/credits/serverMetering";

export const runtime = "nodejs";
export const maxDuration = 60;

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "_");
}

function cleanTextForTTS(value: string) {
  if (!value) {
    return "";
  }

  let text = value;

  text = text
    .replace(
      /\([^)]*(?:ton|anlatım|duygu|emotion|style|voice|narrator|ses|sakin|doğal|heyecanlı|neşeli|duygusal|yumuşak|enerjik|meraklı|sıcak)[^)]*\)/gi,
      ""
    )
    .replace(
      /\[[^\]]*(?:ton|anlatım|duygu|emotion|style|voice|narrator|ses|sakin|doğal|heyecanlı|neşeli|duygusal|yumuşak|enerjik|meraklı|sıcak)[^\]]*\]/gi,
      ""
    )
    .replace(
      /(?:^|\n)\s*(?:ses\s*tonu|anlatım\s*tonu|duygu|emotion|voice\s*style|narration\s*style)\s*:\s*[^\n.]*[.\n]?/gi,
      "\n"
    )
    .replace(
      /(?:sakin|doğal|heyecanlı|neşeli|duygusal|yumuşak|enerjik|meraklı|sıcak)\s*,?\s*(?:ve\s*)?(?:sakin|doğal|heyecanlı|neşeli|duygusal|yumuşak|enerjik|meraklı|sıcak)?\s*(?:anlatım\s*)?tonu\.?/gi,
      ""
    )
    .replace(
      /(?:calm|natural|warm|excited|gentle|soft|emotional|cheerful|curious)\s*(?:and\s*)?(?:calm|natural|warm|excited|gentle|soft|emotional|cheerful|curious)?\s*(?:narration\s*)?(?:tone|voice)\.?/gi,
      ""
    )
    .replace(/\*\*/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

function getNumericSetting(
  value: unknown,
  fallback: number,
  min = 0,
  max = 1.2
) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(max, Math.max(min, value));
  }

  return fallback;
}

function getNarratorVoiceSettings(
  language: "tr" | "en",
  narratorSettings: Record<string, unknown>,
) {
  const defaults =
    language === "en"
      ? {
          stability: 0.62,
          similarityBoost: 0.86,
          style: 0.18,
          speed: 0.91,
        }
      : {
          stability: 0.58,
          similarityBoost: 0.82,
          style: 0.15,
          speed: 0.9,
        };

  return {
    stability: getNumericSetting(narratorSettings?.stability, defaults.stability),
    similarityBoost: getNumericSetting(
      narratorSettings?.similarityBoost,
      defaults.similarityBoost
    ),
    style: getNumericSetting(narratorSettings?.style, defaults.style),
    speed: getNumericSetting(narratorSettings?.speed, defaults.speed, 0.7, 1.2),
  };
}

async function postHandler(req: NextRequest) {
  let reservation: MeteredOperationReservation | null = null;

  try {
    const principal = await authenticateRequest(req);
    const body = await req.json();

    const rawText = typeof body?.text === "string" ? body.text.trim() : "";
    const text = cleanTextForTTS(rawText);

    const sceneId =
      typeof body?.sceneId === "number" || typeof body?.sceneId === "string"
        ? String(body.sceneId)
        : "unknown";

    const projectKey =
      typeof body?.projectKey === "string" && body.projectKey.trim()
        ? body.projectKey.trim()
        : "temp-project";

    const narratorSettings = body?.narratorSettings || {};
    const language = body?.language === "en" ? "en" : "tr";
    const isCreatorLab = body?.productProfile === "creatorlab";

    if (!text) {
      return NextResponse.json(
        { ok: false, error: "Text is required after TTS cleanup" },
        { status: 400 }
      );
    }

    const voiceProvider = getMediaProviderFacade().voice();
    const selectedVoiceProfile = getCreatorVoiceProfileServerSelection(
      narratorSettings?.voiceProfileId,
    );
    const explicitVoiceId =
      typeof narratorSettings.voiceId === "string" &&
      narratorSettings.voiceId.trim()
        ? narratorSettings.voiceId.trim()
        : "";
    const voiceId =
      explicitVoiceId ||
      resolveCreatorVoiceProfileVoiceId({
        profileId: selectedVoiceProfile.id,
        language,
        role: "narrator",
      }) ||
      voiceProvider.getDefaultVoiceId(language, "narrator");

    if (!voiceId) {
      throw new Error("Narrator voice is not configured");
    }

    const modelId =
      typeof narratorSettings.modelId === "string" &&
      narratorSettings.modelId.trim()
        ? narratorSettings.modelId.trim()
        : voiceProvider.getDefaultModelId();

    const finalText = text;
    const creatorVoiceRoute = isCreatorLab
      ? getCreatorVoiceRoute({
          qualityMode: body?.qualityMode,
          format: body?.creatorFormat,
          role: "narrator",
          language,
          text: finalText,
          companionText: body?.companionText,
          targetSceneDurationSec: body?.targetSceneDurationSec,
          sceneIndex: body?.sceneIndex,
          sceneCount: body?.sceneCount,
          voiceProfile: body?.voiceProfile,
          hasExplicitVoiceId: Boolean(narratorSettings?.voiceId),
        })
      : null;

    if (creatorVoiceRoute && !creatorVoiceRoute.canGenerate) {
      const isDraft = creatorVoiceRoute.qualityMode === "draft";

      return NextResponse.json(
        {
          ok: false,
          error: isDraft
            ? language === "tr"
              ? "Taslak modunda seslendirme üretilmez."
              : "Draft mode does not generate voice-over."
            : language === "tr"
              ? "Anlatım bu sahnenin güvenli süresini aşıyor. Ses üretmeden önce metni kısalt veya sahneyi böl."
              : creatorVoiceRoute.warning,
          voiceRoute: creatorVoiceRoute,
        },
        { status: isDraft ? 403 : 422 },
      );
    }

    const voiceSettingsInput =
      narratorSettings?.advancedTuning === true
        ? { ...selectedVoiceProfile.settings, ...narratorSettings }
        : selectedVoiceProfile.settings;
    const voiceSettings = creatorVoiceRoute
      ? getCreatorRoutedVoiceSettings({
          route: creatorVoiceRoute,
          settings: voiceSettingsInput,
        })
      : getNarratorVoiceSettings(language, voiceSettingsInput);

    reservation = await reserveMeteredOperation(req, {
      operationType: "creator_voice",
      qualityMode: body?.qualityMode,
      provider: voiceProvider.key,
      referenceId: `${projectKey}:scene-${sceneId}:narration`,
      metadata: {
        productProfile: isCreatorLab ? "creatorlab" : "storyverse",
        projectKey,
        sceneId,
        role: "narrator",
        voiceProfileId: selectedVoiceProfile.id,
      },
      billable: isCreatorLab,
      requireCostGuardConfirmation: isCreatorLab,
    });

    const voiceResult = await voiceProvider.synthesize({
      text: finalText,
      voiceId,
      modelId,
      settings: voiceSettings,
      outputFormat: "mp3_44100_128",
      timeoutMs: 30_000,
    });
    const buffer = voiceResult.audio;

    const services = getPersistenceServices();

    const safeProjectKey = safeName(projectKey);
    const safeSceneId = safeName(sceneId);

    const filePath = `${safeProjectKey}/scene-${safeSceneId}-narration-${Date.now()}.mp3`;

    const storedAudio = await services.objectStorage.uploadPublic({
      bucket: "audio",
      path: filePath,
      body: buffer,
      contentType: voiceResult.contentType,
      upsert: false,
    });
    await registerStoredAssetOrThrow({ repository: services.mediaAssetRepository, ownerUserId: principal.id,
      bucket: storedAudio.bucket, storagePath: storedAudio.path, publicUrl: storedAudio.publicUrl,
      mediaKind: "narration_audio", mimeType: voiceResult.contentType, body: buffer,
      metadata: { projectKey: safeProjectKey, sceneId: safeSceneId } });
    const clientSettingsKey =
      typeof body?.clientSettingsKey === "string" && body.clientSettingsKey.trim()
        ? body.clientSettingsKey.trim()
        : "";
    const settingsKey =
      clientSettingsKey ||
      [
        selectedVoiceProfile.id,
        voiceId,
        modelId,
        voiceSettings.stability,
        voiceSettings.similarityBoost,
        voiceSettings.style,
        voiceSettings.speed,
        language,
        creatorVoiceRoute?.routeKey || "storyverse",
      ].join("-");

    const chargedCredits = reservation?.reservedCredits || 0;
    const creditResult = reservation
      ? await settleMeteredOperation(reservation, {
          providerRequestId: voiceResult.requestId,
          metadata: { audioPath: storedAudio.path },
        })
      : null;
    reservation = null;

    return NextResponse.json({
      ok: true,
      audioUrl: storedAudio.publicUrl,
      audioPath: storedAudio.path,
      audioSourceText: finalText,
      cleanedText: finalText,
      originalText: rawText,
      language,
      voiceId,
      voiceProfileId: selectedVoiceProfile.id,
      voiceSettings,
      settingsKey,
      credits: creditResult
        ? { chargedCredits, account: creditResult.account }
        : { chargedCredits: 0 },
      voiceRoute: creatorVoiceRoute
        ? {
            strategy: creatorVoiceRoute.voiceStrategy,
            deliveryStyle: creatorVoiceRoute.deliveryStyle,
            continuity: creatorVoiceRoute.continuity,
            timingStatus: creatorVoiceRoute.timingStatus,
            estimatedSpeechSeconds:
              creatorVoiceRoute.estimatedSpeechSecondsAtRouteSpeed,
            targetSceneDurationSec: creatorVoiceRoute.targetSceneDurationSec,
            warning: creatorVoiceRoute.warning,
          }
        : null,
    });
  } catch (error: unknown) {
    if (reservation) {
      await releaseMeteredOperation(reservation, "voice_generation_failed", {
        route: "store-audio",
      });
    }

    const creditErrorResponse = getCreditErrorResponse(error);
    if (creditErrorResponse) return creditErrorResponse;

    console.error("store-audio error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: getProviderPublicMessage(
          error,
          "Ses üretimi tamamlanamadı.",
        ),
      },
      { status: 500 }
    );
  }
}

export const POST = withObservedApiRoute("api.store-audio", postHandler);
