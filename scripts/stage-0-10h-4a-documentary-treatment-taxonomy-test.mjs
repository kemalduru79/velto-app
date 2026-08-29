import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/creator/productionIntelligence.ts", "utf8");

const canonicalTreatments = [
  "reuse_existing",
  "stock_photo",
  "stock_video",
  "ai_image",
  "image_motion",
  "ai_video",
  "source_clip",
  "source_image",
  "data_visual",
  "quote_card",
  "source_card",
];

for (const treatment of canonicalTreatments) {
  assert.match(
    source,
    new RegExp(`\\b${treatment}\\b`),
    `Creator Production Intelligence must expose ${treatment}`,
  );
}

assert.match(
  source,
  /export const CREATOR_PRODUCTION_TREATMENTS:[\s\S]*?source_clip[\s\S]*?source_image[\s\S]*?data_visual[\s\S]*?quote_card[\s\S]*?source_card/,
  "H-4A must expose the canonical documentary treatment taxonomy",
);

const routedTreatments = source.match(
  /const routedTreatments: CreatorProductionTreatment\[\] = \[([^\]]+)\]/,
)?.[1] || "";

for (const legacyTreatment of canonicalTreatments.slice(0, 6)) {
  assert.match(
    routedTreatments,
    new RegExp(`"${legacyTreatment}"`),
    `Legacy automatic router must preserve ${legacyTreatment}`,
  );
}
for (const documentaryTreatment of canonicalTreatments.slice(6)) {
  assert.doesNotMatch(
    routedTreatments,
    new RegExp(`"${documentaryTreatment}"`),
    `${documentaryTreatment} must not become automatically routable before later H-4 slices`,
  );
  assert.match(
    source,
    new RegExp(`${documentaryTreatment}: 0`),
    `${documentaryTreatment} must have a neutral score until documentary routing is implemented`,
  );
}

for (const documentaryTreatment of canonicalTreatments.slice(6)) {
  assert.match(
    source,
    new RegExp(`${documentaryTreatment}: \\{ en: ".+", tr: ".+" \\}`),
    `${documentaryTreatment} must have bilingual labels`,
  );
}

assert.match(
  source,
  /Object\.fromEntries\(CREATOR_PRODUCTION_TREATMENTS\.map/,
  "Decision score output must expose the complete canonical taxonomy",
);

console.log("Stage 0.10H-4A documentary treatment taxonomy tests passed.");
