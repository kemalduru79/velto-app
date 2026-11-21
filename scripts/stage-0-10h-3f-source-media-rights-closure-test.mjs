import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const sourceMedia = read("lib/creator/sourceMedia.ts");
const mediaTypes = read("lib/persistence/media/types.ts");
const mediaRepository = read("lib/persistence/media/supabaseMediaAssetRepository.ts");
const stockMetadata = read("lib/providers/stock/sourceMetadata.ts");
const researchReference = read("lib/research/sourceMediaReference.ts");
const sourceMediaUsage = read("lib/creator/sourceMediaUsage.ts");

// H-3A — one compact Source Media + rights contract.
for (const field of [
  "sourceUrl",
  "publisher",
  "rightsholder",
  "publishedAt",
  "capturedAt",
  "licenseId",
  "licenseUrl",
  "licenseSnapshotDate",
  "attributionRequired",
  "attributionText",
  "rightsState",
  "sourceDurationSec",
  "timecodeStartSec",
  "timecodeEndSec",
]) {
  assert.match(sourceMedia, new RegExp(`\\b${field}\\b`));
}
for (const state of ["unknown", "review_required", "cleared", "restricted"]) {
  assert.match(sourceMedia, new RegExp(`"${state}"`));
}
assert.doesNotMatch(sourceMedia, /legally[_ -]?safe|safe[_ -]?to[_ -]?use/i);
assert.match(sourceMedia, /license or attribution field never upgrades rightsState/i);

// H-3B — use the existing media-asset metadata envelope; no second store.
assert.match(mediaTypes, /metadata\?: Record<string, unknown>;/);
assert.match(mediaRepository, /BASE_ASSET_FIELDS:[^\n]*metadata/);
assert.match(mediaRepository, /metadata: assetMetadata\(row\.metadata\)/);
assert.match(mediaRepository, /metadata: input\.metadata \|\| \{\}/);

// H-3C — existing stock provenance is canonicalized conservatively.
assert.match(stockMetadata, /withCreatorSourceMediaMetadata/);
assert.match(stockMetadata, /publisher: "Pexels"/);
assert.match(stockMetadata, /rightsholder: ""/);
assert.match(stockMetadata, /attributionRequired: null/);
assert.match(stockMetadata, /rightsState: "review_required"/);
assert.doesNotMatch(stockMetadata, /rightsState: "cleared"/);

// H-3D — research sources become references only; public URLs are not downloaded.
assert.match(researchReference, /createResearchSourceMediaReference/);
assert.match(researchReference, /rightsState: "review_required"/);
assert.match(researchReference, /does not download media/i);
assert.doesNotMatch(researchReference, /\bfetch\s*\(/);
assert.doesNotMatch(researchReference, /providerRequestId|providerCostUsd|rawProviderPayload/);

// H-3E — existing CreatorLab trim logic remains the only clip-trim authority.
assert.match(sourceMediaUsage, /normalizeCreatorSceneTrim/);
assert.match(sourceMediaUsage, /No second clip editor or trim algorithm is introduced here/);
assert.doesNotMatch(sourceMediaUsage, /CREATOR_MIN_VIDEO_CLIP_SECONDS\s*=/);
assert.doesNotMatch(sourceMediaUsage, /function constrainCreatorTrimProposal/);

// Governance — do not introduce a Rights Passport, second asset store, or generic social downloader.
const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);
assert.equal(
  trackedFiles.some((path) => /rights[-_]?passport|source[-_]?media[-_]?assets|social[-_]?download/i.test(path)),
  false,
);
assert.equal(
  trackedFiles
    .filter((path) => path.startsWith("app/api/"))
    .some((path) => /(source[-_]?media|social).*download/i.test(path)),
  false,
);

console.log("Stage 0.10H-3F Source Media & Rights closure tests passed.");
