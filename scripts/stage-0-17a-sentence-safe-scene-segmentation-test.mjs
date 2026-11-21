import assert from "node:assert/strict";
import { createCreatorScript, createCreatorScriptSceneSegments } from "../lib/creator/creatorScript.ts";

const normalize = (value) => value.replace(/\s+/g, " ").trim();
const englishSentences = [
  "When memory reconstruction alters key elements of that narrative, it can reshape the sense of self.",
  "For example, if a memory of a formative event is modified—whether by omission, distortion, or emotional reappraisal—the identity anchored in that memory shifts accordingly.",
  "This mechanism reveals why identity is not fixed but fluid, vulnerable to the fallibility of memory.",
];
const sections = [
  { id: "opening", kind: "opening", text: 'Is memory a record? "Not exactly!" Dr. Kaya asks why.', claimIds: [], evidenceReviewRequired: false },
  { id: "section-1", kind: "body", text: englishSentences.join(" "), claimIds: ["claim-1"], evidenceReviewRequired: false },
  { id: "section-2", kind: "body", text: "Bu yaklaşım 2.5 yıl izlendi. Örn. ikinci ölçüm ayrı yapıldı. Sonuç değişti mi? Evet!", claimIds: [], evidenceReviewRequired: false },
  { id: "conclusion", kind: "conclusion", text: "Identity remains an open question.", claimIds: [], evidenceReviewRequired: false },
];
const script = createCreatorScript({
  title: "Sentence-safe scenes",
  sections,
  targetDurationSec: 300,
  strategyFingerprint: "sentence-safe",
  grounding: {
    context: {
      version: "0.10H-2H",
      sourceVersion: "0.10H-2E",
      editorialConstitution: "Preserve canonical text.",
      readiness: { status: "ready", editorialReadinessScore: 100, reviewReasons: [] },
      claims: [{ claimId: "claim-1", claimType: "FACT", text: "Memory is reconstructive.", supportingEvidenceIds: ["evidence-1"], counterEvidenceIds: [], contextualEvidenceIds: [] }],
      evidence: [{ evidenceId: "evidence-1", sourceId: "source-1", excerpt: "Memory is reconstructive.", contextNote: null, locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } }],
      sources: [{ sourceId: "source-1", title: "Source", url: "https://example.test", publisher: "Publisher", author: null, publishedAt: null, directness: "primary", reviewStatus: "usable" }],
    },
  },
  generatedAt: "2026-09-24T00:00:00.000Z",
  updatedAt: "2026-09-24T00:00:00.000Z",
});

const segments = createCreatorScriptSceneSegments(script, 36);
const repeated = createCreatorScriptSceneSegments(script, 36);
assert.deepEqual(repeated, segments, "segmentation must be deterministic");
assert.ok(segments.every((segment) => segment.narration.length > 0), "empty narration is forbidden");
assert.ok(segments.length < 36, "scene count must yield to the available sentence count");

for (const section of script.sections) {
  const owned = segments.filter((segment) => segment.scriptSectionId === section.id);
  assert.ok(owned.length > 0, `section ${section.id} must retain narration`);
  assert.equal(normalize(owned.map((segment) => segment.narration).join(" ")), normalize(section.text));
  assert.ok(owned.every((segment) => segment.editorialClaimIds.join("|") === section.claimIds.join("|")));
}
assert.equal(
  normalize(segments.map((segment) => segment.narration).join(" ")),
  normalize(script.sections.map((section) => section.text).join(" ")),
  "complete canonical text must be preserved exactly apart from whitespace",
);

const bodySegments = segments.filter((segment) => segment.scriptSectionId === "section-1");
assert.deepEqual(bodySegments.map((segment) => segment.narration), englishSentences);
for (const sentence of englishSentences) {
  assert.equal(bodySegments.filter((segment) => segment.narration.includes(sentence)).length, 1);
}
assert.deepEqual(
  segments.map((segment) => segment.scriptSegmentIndex),
  segments.map((_, index) => index),
);
assert.ok(segments.every((segment) => segment.scriptRevision === script.revision));
assert.deepEqual(
  segments.map((segment) => segment.scriptSectionId),
  script.sections.flatMap((section) => segments.filter((segment) => segment.scriptSectionId === section.id).map(() => section.id)),
  "canonical section ownership and order must remain intact",
);

console.log("STAGE_0_17A_SENTENCE_SAFE_SCENE_SEGMENTATION=PASS");
