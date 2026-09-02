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
import { calculateElevenLabsCost, persistEconomicOperationBestEffort, type EconomicCostResult, type EconomicOperationInput } from "@/lib/economics";

export const runtime = "nodejs";

type DialogueLine = {
  speaker: string;
  text: string;
  voiceId?: string;
};

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

function buildDialogueText(lines: DialogueLine[]) {
  return lines
    .filter((line) => line?.text?.trim())
    .map((line) => cleanTextForTTS(line.text))
    .filter((text) => text.trim())
    .join("\n");
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

function getCharacterVoiceSettings(
  language: "tr" | "en",
  body: Record<string, unknown>,
) {
  const defaults =
    language === "en"
      ? {
          stability: 0.28,
          similarityBoost: 0.86,
          style: 0.62,
          speed: 1.02,
        }
      : {
          stability: 0.38,
          similarityBoost: 0.8,
          style: 0.44,
          speed: 0.95,
        };

  return {
    stability: getNumericSetting(body?.stability, defaults.stability),
    similarityBoost: getNumericSetting(body?.similarityBoost, defaults.similarityBoost),
    style: getNumericSetting(body?.style, defaults.style),
    speed: getNumericSetting(body?.speed, defaults.speed, 0.7, 1.2),
  };
}

async function postHandler(req: NextRequest) {
  let reservation: MeteredOperationReservation | null = null;
  let providerAccepted = false;
  let economicCost: EconomicCostResult | null = null;
  let economicAttempt: EconomicOperationInput | null = null;

  try {
    const principal = await authenticateRequest(req);
    const body = await req.json();

    const lines: DialogueLine[] = Array.isArray(body?.lines) ? body.lines : [];

    const projectKey =
      typeof body?.projectKey === "string" && body.projectKey.trim()
        ? body.projectKey.trim()
        : "temp-project";

    const sceneId =
      typeof body?.sceneId === "number" || typeof body?.sceneId === "string"
        ? String(body.sceneId)
        : "unknown";

    const sourceText =
      typeof body?.sourceText === "string" ? body.sourceText : "";

    const language = body?.language === "en" ? "en" : "tr";
    const isCreatorLab = body?.productProfile === "creatorlab";
    const voiceProvider = getMediaProviderFacade().voice();

    const modelId =
      typeof body?.modelId === "string" && body.modelId.trim()
        ? body.modelId.trim()
        : voiceProvider.getDefaultModelId();

    if (!lines.length) {
      return NextResponse.json(
        { ok: false, error: "Dialogue lines are required" },
        { status: 400 }
      );
    }

    const fullText = buildDialogueText(lines);

    if (!fullText.trim()) {
      return NextResponse.json(
        { ok: false, error: "No dialogue audio could be generated after TTS cleanup" },
        { status: 400 }
      );
    }

    const selectedVoiceProfile = getCreatorVoiceProfileServerSelection(
      body?.voiceProfileId,
    );
    const defaultCharacterVoiceId = voiceProvider.getDefaultVoiceId(
      language,
      "character",
    );
    const narratorVoiceId = voiceProvider.getDefaultVoiceId(
      language,
      "narrator",
    );

    const explicitBodyVoiceId =
      typeof body?.voiceId === "string" ? body.voiceId.trim() : "";
    const firstLineVoiceId =
      lines.find((line) => line?.voiceId?.trim())?.voiceId?.trim() || "";

    const finalVoiceId =
      explicitBodyVoiceId ||
      (firstLineVoiceId?.trim() &&
      firstLineVoiceId?.trim() !== narratorVoiceId?.trim()
        ? firstLineVoiceId.trim()
        : "") ||
      resolveCreatorVoiceProfileVoiceId({
        profileId: selectedVoiceProfile.id,
        language,
        role: "character",
      }) ||
      defaultCharacterVoiceId?.trim();

    if (!finalVoiceId) {
      throw new Error(
        "No character voice is configured for the selected Velto voice profile."
      );
    }

    const creatorVoiceRoute = isCreatorLab
      ? getCreatorVoiceRoute({
          qualityMode: body?.qualityMode,
          format: body?.creatorFormat,
          role: "dialogue",
          language,
          text: fullText,
          companionText: body?.companionText,
          targetSceneDurationSec: body?.targetSceneDurationSec,
          sceneIndex: body?.sceneIndex,
          sceneCount: body?.sceneCount,
          voiceProfile: body?.voiceProfile,
          hasExplicitVoiceId: Boolean(explicitBodyVoiceId || firstLineVoiceId),
        })
      : null;

    if (creatorVoiceRoute && !creatorVoiceRoute.canGenerate) {
      const isDraft = creatorVoiceRoute.qualityMode === "draft";

      return NextResponse.json(
        {
          ok: false,
          error: isDraft
            ? language === "tr"
              ? "Taslak modunda diyalog sesi üretilmez."
              : "Draft mode does not generate dialogue audio."
            : language === "tr"
              ? "Diyalog bu sahnenin güvenli süresini aşıyor. Ses üretmeden önce metni kısalt veya sahneyi böl."
              : creatorVoiceRoute.warning,
          voiceRoute: creatorVoiceRoute,
        },
        { status: isDraft ? 403 : 422 },
      );
    }

    const voiceSettingsInput =
      body?.advancedVoiceTuning === true
        ? { ...selectedVoiceProfile.settings, ...body }
        : selectedVoiceProfile.settings;
    const voiceSettings = creatorVoiceRoute
      ? getCreatorRoutedVoiceSettings({
          route: creatorVoiceRoute,
          settings: voiceSettingsInput,
        })
      : getCharacterVoiceSettings(language, voiceSettingsInput);

    reservation = await reserveMeteredOperation(req, {
      operationType: "creator_dialogue_voice",
      qualityMode: body?.qualityMode,
      provider: voiceProvider.key,
      referenceId: `${projectKey}:scene-${sceneId}:dialogue`,
      metadata: {
        productProfile: isCreatorLab ? "creatorlab" : "storyverse",
        projectKey,
        sceneId,
        role: "dialogue",
        voiceProfileId: selectedVoiceProfile.id,
      },
      billable: isCreatorLab,
      requireCostGuardConfirmation: isCreatorLab,
      admissionMode: isCreatorLab ? "creator_accounting" : "balance_backed",
      accounting: isCreatorLab ? {
        attemptKey: `${req.headers.get("x-idempotency-key")!.trim()}:elevenlabs-dialogue:1`,
        route: "/api/store-dialogue-audio",
        operationType: "creator_dialogue_voice",
        productTier: creatorVoiceRoute?.qualityMode || null,
        providerTier: voiceProvider.tier,
        model: modelId,
        projectId: projectKey,
        sceneId,
      } : undefined,
    });

    const voiceResult = await voiceProvider.synthesize({
      text: fullText,
      voiceId: finalVoiceId,
      modelId,
      settings: voiceSettings,
      outputFormat: "mp3_44100_128",
      timeoutMs: 30_000,
    });
    providerAccepted = true;
    const outputBuffer = voiceResult.audio;
    economicCost = calculateElevenLabsCost(modelId, fullText.length);
    const logicalOperationId = req.headers.get("x-idempotency-key")?.trim() || reservation?.reservationId || `dialogue:${voiceResult.requestId || crypto.randomUUID()}`;
    economicAttempt = { attemptKey: `${logicalOperationId}:elevenlabs-dialogue:1`, logicalOperationId, idempotencyKey: req.headers.get("x-idempotency-key"), creditReservationId: reservation?.reservationId,
      userId: principal.id, projectId: projectKey, sceneId, route: "/api/store-dialogue-audio", operationType: "creator_dialogue_voice", productTier: creatorVoiceRoute?.qualityMode || null,
      provider: voiceProvider.key, providerTier: voiceProvider.tier, model: modelId, providerRequestId: voiceResult.requestId || null, state: "provider_billed", billingMoment: "provider_completed",
      quantities: { characterCount: fullText.length, audioBytes: outputBuffer.byteLength, requestCount: 1 }, cost: economicCost, dispatchedAt: new Date().toISOString(), providerAcceptedAt: new Date().toISOString(), completedAt: new Date().toISOString() };
    await persistEconomicOperationBestEffort(economicAttempt);

    const services = getPersistenceServices();

    const safeProjectKey = safeName(projectKey);
    const safeSceneId = safeName(sceneId);
    const filePath = `${safeProjectKey}/scene-${safeSceneId}-dialogue-${Date.now()}.mp3`;

    const storedAudio = await services.objectStorage.uploadPublic({
      bucket: "dialogue-audio",
      path: filePath,
      body: outputBuffer,
      contentType: voiceResult.contentType,
      upsert: false,
    });
    await registerStoredAssetOrThrow({ repository: services.mediaAssetRepository, ownerUserId: principal.id,
      bucket: storedAudio.bucket, storagePath: storedAudio.path, publicUrl: storedAudio.publicUrl,
      mediaKind: "dialogue_audio", mimeType: voiceResult.contentType, body: outputBuffer,
      metadata: { projectKey: safeProjectKey, sceneId: safeSceneId } });

    const clientSettingsKey =
      typeof body?.clientSettingsKey === "string" && body.clientSettingsKey.trim()
        ? body.clientSettingsKey.trim()
        : "";
    const settingsKey =
      clientSettingsKey ||
      [
        selectedVoiceProfile.id,
        finalVoiceId,
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
          providerCostUsd: economicCost.providerCostUsd ?? undefined,
          providerRequestId: voiceResult.requestId,
          metadata: { audioPath: storedAudio.path },
        })
      : null;
    reservation = null;

    return NextResponse.json({
      ok: true,
      audioUrl: storedAudio.publicUrl,
      audioPath: storedAudio.path,
      sourceText,
      cleanedText: fullText,
      language,
      voiceId: finalVoiceId,
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
      if (providerAccepted) {
        await persistEconomicOperationBestEffort({ ...(economicAttempt || { attemptKey: `${reservation.reservationId}:elevenlabs-dialogue:1`, logicalOperationId: reservation.reservationId, userId: reservation.userId, route: "/api/store-dialogue-audio", operationType: "creator_dialogue_voice", state: "application_failed_after_provider_cost" }), state: "application_failed_after_provider_cost", ambiguityReason: error instanceof Error ? error.message : "downstream_failure", failedAt: new Date().toISOString() });
        try { await settleMeteredOperation(reservation, { providerCostUsd: economicCost?.providerCostUsd ?? undefined, metadata: { applicationFailedAfterProviderCost: true } }); } catch {}
      } else await releaseMeteredOperation(reservation, "dialogue_voice_generation_failed", { route: "store-dialogue-audio" });
    }

    const creditErrorResponse = getCreditErrorResponse(error);
    if (creditErrorResponse) return creditErrorResponse;

    console.error("store-dialogue-audio error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: getProviderPublicMessage(
          error,
          "Diyalog sesi üretimi tamamlanamadı.",
        ),
      },
      { status: 500 }
    );
  }
}

export const POST = withObservedApiRoute("api.store-dialogue-audio", postHandler);
