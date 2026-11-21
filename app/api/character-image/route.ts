import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  getCreditErrorResponse,
  releaseMeteredOperation,
  reserveMeteredOperation,
  settleMeteredOperation,
  type MeteredOperationReservation,
} from "@/lib/credits/serverMetering";
import {
  normalizeCreatorQualityMode,
  type CreatorQualityMode,
} from "../../../lib/creator/mediaRouting";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { checkStorageGenerationAllowance, StorageQuotaOperationalError, storageQuotaFullResponse, storageQuotaOperationalErrorResponse } from "@/lib/persistence/media/storageQuota.server";
import { calculateOpenAIImageCost, normalizeOpenAIImageUsage, persistEconomicOperationBestEffort, unknownCost, type EconomicCostResult } from "@/lib/economics";

export const runtime = "nodejs";

type Character = {
  id?: string;
  name: string;
  age: string;
  appearance: string;
  outfit: string;
  accessory?: string;
  personality: string;
};

type VisualBible = {
  style: string;
  palette: string;
  camera: string;
  consistencyRules: string;
};

type ImageProductProfile = "storyverse" | "creatorlab";

type ImageApiResponse = {
  data?: Array<{ b64_json?: string | null }>;
  usage?: unknown;
  _request_id?: string;
};

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  return new OpenAI({ apiKey });
}

function getCreatorCharacterRoute(qualityMode: CreatorQualityMode) {
  if (qualityMode === "cinematic") {
    return {
      model: "gpt-image-2-2026-04-21",
      quality: "high",
      size: "1024x1024",
    } as const;
  }

  if (qualityMode === "pro") {
    return {
      model: "gpt-image-2-2026-04-21",
      quality: "high",
      size: "1024x1024",
    } as const;
  }

  return {
    model: "gpt-image-2-2026-04-21",
    quality: "medium",
    size: "1024x1024",
  } as const;
}

export async function POST(req: Request) {
  let reservation: MeteredOperationReservation | null = null;
  let providerSucceeded = false;
  let economicCost: EconomicCostResult | null = null;

  try {
    const principal = await authenticateRequest(req);
    const {
      title,
      character,
      visualBible,
      productProfile,
      qualityMode,
    }: {
      title?: string;
      character?: Character;
      visualBible?: VisualBible;
      productProfile?: ImageProductProfile;
      qualityMode?: unknown;
    } = await req.json();

    if (!character || !character.name?.trim()) {
      return NextResponse.json(
        { error: "Karakter bilgisi zorunludur." },
        { status: 400 },
      );
    }

    const normalizedProductProfile: ImageProductProfile =
      productProfile === "creatorlab" ? "creatorlab" : "storyverse";
    const normalizedQualityMode = normalizeCreatorQualityMode(
      qualityMode,
      "standard",
    );
    const isCreatorLab = normalizedProductProfile === "creatorlab";

    if (isCreatorLab && normalizedQualityMode === "draft") {
      return NextResponse.json(
        {
          error:
            "Draft mode is text-only. Select Standard, Pro or Cinematic before generating a character reference.",
        },
        { status: 409 },
      );
    }

    const storageAllowance = await checkStorageGenerationAllowance(principal.id);
    if (!storageAllowance.allowed) return storageQuotaFullResponse(storageAllowance.storage);

    const creatorRoute = getCreatorCharacterRoute(normalizedQualityMode);

    if (isCreatorLab) {
      reservation = await reserveMeteredOperation(req, {
        operationType: "creator_image",
        qualityMode: normalizedQualityMode,
        provider: "openai",
        referenceId: character.id?.trim()
          ? `character:${character.id.trim()}:reference`
          : "character:unassigned:reference",
        metadata: {
          productProfile: "creatorlab",
          characterId: character.id?.trim() || null,
          qualityMode: normalizedQualityMode,
          purpose: "character_reference",
        },
        billable: true,
        requireCostGuardConfirmation: true,
        admissionMode: "creator_accounting",
        accounting: {
          attemptKey: `${req.headers.get("x-idempotency-key")!.trim()}:openai-image:1`,
          route: "/api/character-image",
          operationType: "creator_character_image",
          productTier: normalizedQualityMode,
          providerTier: "primary",
          model: creatorRoute.model,
        },
      });
    }

    const prompt = isCreatorLab
      ? `
Create a premium master character reference portrait for a professional 18+ creator production.

Production title:
${title || "Untitled Creator Production"}

Character / persona:
Name: ${character.name}
Age: ${character.age || "adult"}
Appearance: ${character.appearance || "not specified"}
Outfit: ${character.outfit || "not specified"}
Accessory: ${character.accessory || "No accessory"}
Personality: ${character.personality || "not specified"}

Visual bible:
Style: ${visualBible?.style || "professional creator-grade visual direction"}
Palette: ${visualBible?.palette || "clean premium color system"}
Camera: ${visualBible?.camera || "clean reference portrait framing"}
Consistency rules: ${visualBible?.consistencyRules || "preserve the same face, hair, outfit, age impression, body proportions, and realism level"}

This image will be the canonical master identity for future scenes.

Requirements:
- depict a clearly adult fictional person; do not imitate a celebrity, public figure, or unrelated real person
- photorealistic human rendering when the visual bible requests realism
- natural face structure, skin texture, hair, eyes, teeth, hands, and anatomy
- clear front-facing or three-quarter identity view
- readable hairstyle, hair color, outfit, accessory, silhouette, and proportions
- neutral premium studio lighting that does not hide identity
- clean uncluttered background
- no extra main characters
- no text, letters, numbers, logos, watermarks, or interface elements
- avoid waxy skin, plastic face, distorted anatomy, glamour-filter artifacts, style drift, or generic stock-photo composition
- make the identity reusable and stable across multiple production scenes
`
      : `
Create a premium character reference sheet style portrait for a children's 3D animated feature film.

Story title:
${title || "Untitled Story"}

Character:
Name: ${character.name}
Age: ${character.age}
Appearance: ${character.appearance}
Outfit: ${character.outfit}
Accessory: ${character.accessory || "No accessory"}
Personality: ${character.personality}

Visual bible:
Style: ${visualBible?.style || "warm child-friendly animated film"}
Palette: ${visualBible?.palette || "soft vibrant colors"}
Camera: ${visualBible?.camera || "clean character presentation"}
Consistency rules: ${visualBible?.consistencyRules || "keep same face, same hair, same outfit, same age look"}

CRITICAL:
This generated image will be used as the MASTER reference for all future scenes.

Requirements:
- extremely clear face, hairstyle, hair color, outfit, and silhouette
- no ambiguity in design
- must be reusable across multiple scenes
- avoid temporary props that could confuse the canonical design
- avoid dramatic lighting that hides the character identity
- show only this character as the clear main subject
- premium 3D animated movie design, not flat 2D
- cinematic but clean studio lighting
- expressive face with strong emotional readability
- detailed but simple child-friendly design
- no crowded background or extra main characters
- stable front-facing or three-quarter character presentation
- avoid cheap vector art, low-detail cartoon style, generic AI slideshow style, plastic toy look, distorted anatomy, unreadable face, and style drift
`;

    const request = isCreatorLab
      ? {
          model: creatorRoute.model,
          prompt,
          size: creatorRoute.size,
          quality: creatorRoute.quality,
        }
      : {
          model: "gpt-image-1",
          prompt,
          size: "1024x1024",
          quality: "high",
        } as const;

    const client = getOpenAIClient();
    const image = (await client.images.generate({
      ...request,
      stream: false,
    })) as unknown as ImageApiResponse;
    const base64 = image.data?.[0]?.b64_json;

    if (!base64) {
      return NextResponse.json(
        { error: "Karakter görseli üretilemedi." },
        { status: 500 },
      );
    }

    providerSucceeded = true;
    const normalizedUsage = normalizeOpenAIImageUsage(image.usage);
    economicCost = image.usage ? calculateOpenAIImageCost(request.model, normalizedUsage) : unknownCost(`Image provider did not return usage for ${request.model}.`);
    const logicalOperationId = req.headers.get("x-idempotency-key")?.trim() || reservation?.reservationId || `character-image:${image._request_id || crypto.randomUUID()}`;
    await persistEconomicOperationBestEffort({ attemptKey: `${logicalOperationId}:openai-image:1`, logicalOperationId, idempotencyKey: req.headers.get("x-idempotency-key"), creditReservationId: reservation?.reservationId, userId: principal.id, route: "/api/character-image", operationType: isCreatorLab ? "creator_character_image" : "legacy_character_image", productTier: isCreatorLab ? normalizedQualityMode : null, provider: "openai", providerTier: "primary", model: request.model, providerRequestId: image._request_id || null, state: "provider_billed", billingMoment: "provider_completed", quantities: { ...normalizedUsage, imageCount: 1, quality: request.quality, dimensions: request.size, requestCount: 1 }, cost: economicCost, dispatchedAt: new Date().toISOString(), providerAcceptedAt: new Date().toISOString(), completedAt: new Date().toISOString() });
    const chargedCredits = reservation?.reservedCredits || 0;
    const creditResult = reservation
      ? await settleMeteredOperation(reservation, {
          providerCostUsd: economicCost.providerCostUsd ?? undefined,
          metadata: {
            route: "character-image",
            purpose: "character_reference",
            model: request.model,
            quality: request.quality,
            size: request.size,
          },
        })
      : null;
    reservation = null;

    return NextResponse.json({
      image: `data:image/png;base64,${base64}`,
      usage: image.usage || null,
      credits: creditResult
        ? { chargedCredits, account: creditResult.account }
        : { chargedCredits: 0 },
      visualRoute: isCreatorLab
        ? {
            qualityMode: normalizedQualityMode,
            model: creatorRoute.model,
            quality: creatorRoute.quality,
            size: creatorRoute.size,
          }
        : {
            productProfile: "storyverse",
            model: "gpt-image-1",
            quality: "high",
            size: "1024x1024",
          },
    });
  } catch (error) {
    if (reservation) {
      if (providerSucceeded) {
        try {
          await settleMeteredOperation(reservation, {
            providerCostUsd: economicCost?.providerCostUsd ?? undefined,
            metadata: {
              route: "character-image",
              purpose: "character_reference",
              settlementRetry: true,
            },
          });
        } catch {
          console.error("character-image credit settlement failed after provider success");
        }
      } else {
        await releaseMeteredOperation(
          reservation,
          "character_reference_generation_failed",
          { route: "character-image", purpose: "character_reference" },
        );
      }
    }

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, error: "A valid session is required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    if (error instanceof StorageQuotaOperationalError) return storageQuotaOperationalErrorResponse(error);
    const creditErrorResponse = getCreditErrorResponse(error);
    if (creditErrorResponse) return creditErrorResponse;

    console.error("character-image error:", error);

    return NextResponse.json(
      { error: "Karakter referans görseli oluşturulurken hata oluştu." },
      { status: 500 },
    );
  }
}
