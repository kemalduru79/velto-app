export type CreatorPublishRequirementCode =
  | "production_package"
  | "final_video"
  | "thumbnail"
  | "publishing_metadata"
  | "captions"
  | "target_platform"
  | "system_checks"
  | "creator_confirmations";

export type CreatorPublishRequirement = {
  code: CreatorPublishRequirementCode;
  ready: boolean;
};

export type CreatorPublishReadyPackageReport = {
  version: "3R";
  mode: "enforced_publish_preflight";
  status: "ready" | "blocked";
  canExport: boolean;
  readyRequirements: number;
  totalRequirements: number;
  missingRequirementCodes: CreatorPublishRequirementCode[];
  requirements: CreatorPublishRequirement[];
};

type CreatorPublishReadyPackageInput = {
  productionPackage?: unknown;
  videoUrl?: unknown;
  thumbnail?: unknown;
  metadata?: unknown;
  scenes?: unknown;
  targetPlatforms?: unknown;
  releaseChecklist?: unknown;
};

const REQUIRED_CONFIRMATIONS = [
  "videoReviewed",
  "claimsVerified",
  "rightsConfirmed",
  "thumbnailApproved",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasText(value: unknown) {
  return typeof value === "string" && Boolean(value.trim());
}

function hasProductionPackage(value: unknown) {
  if (!isRecord(value)) return false;

  const scenes = Array.isArray(value.scenes) ? value.scenes : [];
  return hasText(value.title) && scenes.length > 0;
}

function hasThumbnail(value: unknown) {
  return isRecord(value) && hasText(value.imageUrl);
}

function hasPublishingMetadata(value: unknown) {
  if (!isRecord(value)) return false;

  const titleOptions = Array.isArray(value.titleOptions)
    ? value.titleOptions
    : [];
  const hasTitle =
    hasText(value.recommendedTitle) ||
    titleOptions.some((item) => hasText(item));

  return hasTitle && hasText(value.description);
}

function hasCaptionSource(value: unknown) {
  if (!Array.isArray(value)) return false;

  return value.some(
    (scene) =>
      isRecord(scene) &&
      (hasText(scene.narration) ||
        hasText(scene.dialogue) ||
        hasText(scene.text)),
  );
}

function hasTargetPlatform(value: unknown) {
  return Array.isArray(value) && value.some((item) => hasText(item));
}

function hasReadySystemChecks(releaseChecklist: unknown) {
  if (!isRecord(releaseChecklist)) return false;

  const checks = Array.isArray(releaseChecklist.systemChecks)
    ? releaseChecklist.systemChecks
    : [];

  return (
    checks.length > 0 &&
    checks.every((item) => isRecord(item) && item.ready === true)
  );
}

function hasRequiredConfirmations(releaseChecklist: unknown) {
  if (!isRecord(releaseChecklist)) return false;

  const confirmations = isRecord(releaseChecklist.userConfirmations)
    ? releaseChecklist.userConfirmations
    : {};

  return REQUIRED_CONFIRMATIONS.every(
    (key) => confirmations[key] === true,
  );
}

export function createCreatorPublishReadyPackageReport(
  input: CreatorPublishReadyPackageInput,
): CreatorPublishReadyPackageReport {
  const requirements: CreatorPublishRequirement[] = [
    {
      code: "production_package",
      ready: hasProductionPackage(input.productionPackage),
    },
    {
      code: "final_video",
      ready: hasText(input.videoUrl),
    },
    {
      code: "thumbnail",
      ready: hasThumbnail(input.thumbnail),
    },
    {
      code: "publishing_metadata",
      ready: hasPublishingMetadata(input.metadata),
    },
    {
      code: "captions",
      ready: hasCaptionSource(input.scenes),
    },
    {
      code: "target_platform",
      ready: hasTargetPlatform(input.targetPlatforms),
    },
    {
      code: "system_checks",
      ready: hasReadySystemChecks(input.releaseChecklist),
    },
    {
      code: "creator_confirmations",
      ready: hasRequiredConfirmations(input.releaseChecklist),
    },
  ];
  const missingRequirementCodes = requirements
    .filter((requirement) => !requirement.ready)
    .map((requirement) => requirement.code);
  const canExport = missingRequirementCodes.length === 0;

  return {
    version: "3R",
    mode: "enforced_publish_preflight",
    status: canExport ? "ready" : "blocked",
    canExport,
    readyRequirements: requirements.length - missingRequirementCodes.length,
    totalRequirements: requirements.length,
    missingRequirementCodes,
    requirements,
  };
}
