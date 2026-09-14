import {
  isValidCreatorScript,
  normalizeCreatorScript,
  type CreatorScript,
} from "./creatorScript.ts";
import {
  convertLegacyCreatorBackgroundMusic,
  normalizeCreatorAudioTimeline,
  readCreatorAudioTimelineField,
  type CreatorAudioTimeline,
  type CreatorLegacyMusicMigration,
} from "./audioTimeline.ts";
import { normalizeCreatorTopicAuthority } from "./creatorWorkflowAuthority.ts";

export const CREATOR_PROJECT_STATE_VERSION = 1 as const;

export type CreatorProjectStateSnapshot = {
  version: typeof CREATOR_PROJECT_STATE_VERSION;
  brief: {
    topic: string;
    language: "tr" | "en";
    country: string;
    ageGroup: string;
    contentType: string;
    outcome?: string;
    format: string;
    durationPreset: string;
    durationSec: number;
    customDurationSec: number;
    qualityMode: string;
    targetPlatforms: string[];
  };
  strategy: {
    mentorResult: unknown | null;
    selectedDirectionId: string;
    selectedHook: string;
    strategyFingerprint?: string;
    profileSnapshot?: unknown;
    script: CreatorScript | null;
  };
  production: {
    package: unknown | null;
    refinedScenes: unknown[];
    backgroundMusic: unknown;
    audioTimeline?: CreatorAudioTimeline | null;
    projectContinuityMode: string;
    sceneContinuityModes: Record<string, string>;
    voicePreferences: unknown | null;
  };
  createReview: {
    scenes: unknown[];
  };
  publish: {
    metadata: unknown | null;
    thumbnail: unknown | null;
    thumbnailDesign: unknown;
    confirmations: Record<string, boolean>;
    packageDownloaded: boolean;
    packageSignature: string;
    finalVideoUrl: string;
    finalVideoSignature: string;
  };
};

export type CreatorProjectStateInput = Omit<CreatorProjectStateSnapshot, "version">;

type LegacyCreatorProject = Record<string, unknown>;

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const hasOwn = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

const isObjectOrNull = (value: unknown) =>
  value === null || (typeof value === "object" && !Array.isArray(value));

const hasOnlyBooleanValues = (value: unknown) => {
  const candidate = record(value);
  return isObjectOrNull(value) && value !== null &&
    Object.values(candidate).every((item) => typeof item === "boolean");
};

const hasOnlyStringValues = (value: unknown) => {
  const candidate = record(value);
  return isObjectOrNull(value) && value !== null &&
    Object.values(candidate).every((item) => typeof item === "string");
};

const hasValidAudioTimelineField = (production: Record<string, unknown>) => {
  if (!hasOwn(production, "audioTimeline") || production.audioTimeline === null) return true;
  try {
    normalizeCreatorAudioTimeline(production.audioTimeline);
    return true;
  } catch {
    return false;
  }
};

export function isValidCreatorProjectState(value: unknown): value is CreatorProjectStateSnapshot {
  const candidate = record(value);
  const brief = record(candidate.brief);
  const strategy = record(candidate.strategy);
  const production = record(candidate.production);
  const createReview = record(candidate.createReview);
  const publish = record(candidate.publish);
  return (
    candidate.version === CREATOR_PROJECT_STATE_VERSION &&
    isObjectOrNull(candidate.brief) && candidate.brief !== null &&
    typeof brief.topic === "string" &&
    (brief.language === "tr" || brief.language === "en") &&
    typeof brief.country === "string" &&
    typeof brief.ageGroup === "string" &&
    typeof brief.contentType === "string" &&
    (!hasOwn(brief, "outcome") || typeof brief.outcome === "string") &&
    typeof brief.format === "string" &&
    typeof brief.durationPreset === "string" &&
    typeof brief.durationSec === "number" && Number.isFinite(brief.durationSec) && brief.durationSec > 0 &&
    typeof brief.customDurationSec === "number" && Number.isFinite(brief.customDurationSec) && brief.customDurationSec > 0 &&
    typeof brief.qualityMode === "string" &&
    Array.isArray(brief.targetPlatforms) && brief.targetPlatforms.every((item) => typeof item === "string") &&
    isObjectOrNull(candidate.strategy) && candidate.strategy !== null &&
    isObjectOrNull(strategy.mentorResult) &&
    typeof strategy.selectedDirectionId === "string" &&
    typeof strategy.selectedHook === "string" &&
    (!hasOwn(strategy, "strategyFingerprint") || typeof strategy.strategyFingerprint === "string") &&
    (!hasOwn(strategy, "profileSnapshot") || isObjectOrNull(strategy.profileSnapshot)) &&
    (!hasOwn(strategy, "script") || strategy.script === null || isValidCreatorScript(strategy.script)) &&
    isObjectOrNull(candidate.production) && candidate.production !== null &&
    isObjectOrNull(production.package) &&
    Array.isArray(production.refinedScenes) &&
    isObjectOrNull(production.backgroundMusic) &&
    hasValidAudioTimelineField(production) &&
    typeof production.projectContinuityMode === "string" &&
    hasOnlyStringValues(production.sceneContinuityModes) &&
    isObjectOrNull(production.voicePreferences) &&
    isObjectOrNull(candidate.createReview) && candidate.createReview !== null &&
    Array.isArray(createReview.scenes) &&
    isObjectOrNull(candidate.publish) && candidate.publish !== null &&
    isObjectOrNull(publish.metadata) &&
    isObjectOrNull(publish.thumbnail) &&
    isObjectOrNull(publish.thumbnailDesign) &&
    hasOnlyBooleanValues(publish.confirmations) &&
    typeof publish.packageDownloaded === "boolean" &&
    typeof publish.packageSignature === "string" &&
    typeof publish.finalVideoUrl === "string" &&
    typeof publish.finalVideoSignature === "string"
  );
}

const finitePositive = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function buildCreatorProjectState(
  input: CreatorProjectStateInput,
): CreatorProjectStateSnapshot {
  const production = {
    ...input.production,
    ...creatorAudioTimelineSnapshotFields(input.production.audioTimeline),
  };
  return {
    version: CREATOR_PROJECT_STATE_VERSION,
    ...input,
    brief: {
      ...input.brief,
      topic: normalizeCreatorTopicAuthority(input.brief.topic),
    },
    production,
  };
}

export function creatorAudioTimelineSnapshotFields(
  audioTimeline: CreatorAudioTimeline | null | undefined,
): { audioTimeline?: CreatorAudioTimeline | null } {
  if (audioTimeline === undefined) return {};
  return {
    audioTimeline: audioTimeline === null
      ? null
      : normalizeCreatorAudioTimeline(audioTimeline),
  };
}

export type CreatorAudioTimelineHydration =
  | { state: "null"; timeline: null }
  | { state: "value"; timeline: CreatorAudioTimeline }
  | { state: "legacy"; migration: CreatorLegacyMusicMigration };

export function readCreatorAudioTimelineHydration(
  production: unknown,
  context: { assetId?: string; sceneIds?: string[] } = {},
): CreatorAudioTimelineHydration {
  const source = record(production);
  const canonical = readCreatorAudioTimelineField(source);
  if (canonical.state === "null") return { state: "null", timeline: null };
  if (canonical.state === "value") return { state: "value", timeline: canonical.value };
  return {
    state: "legacy",
    migration: convertLegacyCreatorBackgroundMusic(source.backgroundMusic, context),
  };
}

export function readCreatorProjectState(
  project: LegacyCreatorProject,
): CreatorProjectStateSnapshot {
  const exportResult = record(project.exported_movie_result);
  const candidateSnapshot = record(exportResult.creatorProjectState);
  const candidateProduction = record(candidateSnapshot.production);
  if (
    candidateSnapshot.version === CREATOR_PROJECT_STATE_VERSION &&
    hasOwn(candidateProduction, "audioTimeline") &&
    candidateProduction.audioTimeline !== null
  ) {
    normalizeCreatorAudioTimeline(candidateProduction.audioTimeline);
  }
  const saved = isValidCreatorProjectState(exportResult.creatorProjectState)
    ? record(exportResult.creatorProjectState)
    : {};
  const savedBrief = record(saved.brief);
  const savedStrategy = record(saved.strategy);
  const savedProduction = record(saved.production);
  const savedCreateReview = record(saved.createReview);
  const savedPublish = record(saved.publish);
  const hasCanonicalSnapshot = saved.version === CREATOR_PROJECT_STATE_VERSION;
  const legacyPackage = record(project.creator_production_package);
  const legacyMentor = project.creator_mentor_result || null;
  const legacyMentorRecord = record(legacyMentor);
  const legacyStrategySelection = record(legacyMentorRecord.strategySelection);
  const legacyHookPatterns = stringArray(legacyMentorRecord.hookPatterns);
  const legacyVoicePreferences = legacyPackage.voicePreferences || null;
  const legacyContinuity = record(legacyPackage.visualContinuity);
  const legacyThumbnail = project.youtube_thumbnail || null;

  return buildCreatorProjectState({
    brief: {
      topic: normalizeCreatorTopicAuthority(
        savedBrief.topic ?? project.input_prompt ?? project.title ?? "",
      ),
      language: (savedBrief.language ?? project.language) === "en" ? "en" : "tr",
      country: String(savedBrief.country ?? "global"),
      ageGroup: String(savedBrief.ageGroup ?? "professional_18"),
      contentType: String(savedBrief.contentType ?? legacyPackage.contentType ?? "educational_explainer"),
      ...(typeof (savedBrief.outcome ?? legacyPackage.outcome) === "string"
        ? { outcome: String(savedBrief.outcome ?? legacyPackage.outcome) }
        : {}),
      format: String(
        savedBrief.format ??
          legacyPackage.format ??
          (finitePositive(legacyPackage.durationSec, 60) > 180 ? "youtube_video" : "short_form"),
      ),
      durationPreset: String(savedBrief.durationPreset ?? legacyPackage.durationPreset ?? "short_60"),
      durationSec: finitePositive(savedBrief.durationSec ?? legacyPackage.durationSec, 60),
      customDurationSec: finitePositive(
        savedBrief.customDurationSec ?? savedBrief.durationSec ?? legacyPackage.durationSec,
        60,
      ),
      qualityMode: String(savedBrief.qualityMode ?? legacyPackage.qualityMode ?? "standard"),
      targetPlatforms: stringArray(savedBrief.targetPlatforms ?? legacyPackage.targetPlatforms),
    },
    strategy: {
      mentorResult:
        hasCanonicalSnapshot && hasOwn(savedStrategy, "mentorResult")
          ? savedStrategy.mentorResult
          : legacyMentor,
      selectedDirectionId: String(
        savedStrategy.selectedDirectionId ?? legacyStrategySelection.directionId ?? "recommended",
      ),
      selectedHook: String(
        savedStrategy.selectedHook ??
          legacyStrategySelection.hook ??
          legacyHookPatterns[0] ??
          "",
      ),
      ...(typeof savedStrategy.strategyFingerprint === "string"
        ? { strategyFingerprint: savedStrategy.strategyFingerprint }
        : {}),
      ...(hasOwn(savedStrategy, "profileSnapshot") ? { profileSnapshot: savedStrategy.profileSnapshot } : {}),
      script:
        hasCanonicalSnapshot && hasOwn(savedStrategy, "script") && savedStrategy.script !== null
          ? normalizeCreatorScript(savedStrategy.script)
          : null,
    },
    production: {
      package:
        hasCanonicalSnapshot && hasOwn(savedProduction, "package")
          ? savedProduction.package
          : project.creator_production_package ?? null,
      refinedScenes: Array.isArray(savedProduction.refinedScenes)
        ? savedProduction.refinedScenes
        : Array.isArray(project.refined_creator_scenes)
          ? project.refined_creator_scenes
          : [],
      backgroundMusic: savedProduction.backgroundMusic ?? legacyPackage.backgroundMusic ?? null,
      ...(hasCanonicalSnapshot && hasOwn(savedProduction, "audioTimeline")
        ? {
            audioTimeline: savedProduction.audioTimeline === null
              ? null
              : normalizeCreatorAudioTimeline(savedProduction.audioTimeline),
          }
        : {}),
      projectContinuityMode: String(
        savedProduction.projectContinuityMode ?? legacyContinuity.projectMode ?? "independent",
      ),
      sceneContinuityModes: record(
        savedProduction.sceneContinuityModes ?? legacyContinuity.sceneModes,
      ) as Record<string, string>,
      voicePreferences:
        hasCanonicalSnapshot && hasOwn(savedProduction, "voicePreferences")
          ? savedProduction.voicePreferences
          : legacyVoicePreferences,
    },
    createReview: {
      scenes: Array.isArray(savedCreateReview.scenes)
        ? savedCreateReview.scenes
        : Array.isArray(project.scenes)
          ? project.scenes
          : [],
    },
    publish: {
      metadata:
        hasCanonicalSnapshot && hasOwn(savedPublish, "metadata")
          ? savedPublish.metadata
          : project.youtube_metadata ?? null,
      thumbnail:
        hasCanonicalSnapshot && hasOwn(savedPublish, "thumbnail")
          ? savedPublish.thumbnail
          : legacyThumbnail,
      thumbnailDesign:
        savedPublish.thumbnailDesign ?? record(legacyThumbnail).design ?? null,
      confirmations: Object.fromEntries(
        Object.entries(record(savedPublish.confirmations)).map(([key, value]) => [key, value === true]),
      ),
      packageDownloaded: savedPublish.packageDownloaded === true,
      packageSignature: String(savedPublish.packageSignature ?? ""),
      finalVideoUrl: String(savedPublish.finalVideoUrl ?? project.exported_movie_url ?? ""),
      finalVideoSignature: String(savedPublish.finalVideoSignature ?? project.export_signature ?? ""),
    },
  });
}

export function attachCreatorProjectState(
  exportedMovieResult: unknown,
  snapshot: CreatorProjectStateSnapshot,
) {
  return { ...record(exportedMovieResult), creatorProjectState: snapshot };
}
