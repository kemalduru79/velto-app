import assert from "node:assert/strict";
import {
  buildCreatorEvidencePack,
  buildCreatorEvidencePromptPack,
  CREATOR_EVIDENCE_PROMPT_PACK_MAX_CHARACTERS,
  createCreatorEvidenceUnits,
  selectCreatorEvidencePromptPackForClaims,
} from "../lib/research/creatorEvidencePack.ts";
import {
  normalizeScriptPlannerEditorialContext,
} from "../lib/research/scriptPlannerEditorialContext.ts";

const locator = {
  section: null,
  page: null,
  timecodeStartSec: null,
  timecodeEndSec: null,
};

function source(sourceId, title, directness = "primary") {
  return {
    sourceId,
    title,
    url: `https://example.test/${sourceId}`,
    publisher: "Example Research",
    author: null,
    publishedAt: null,
    directness,
    reviewStatus: "usable",
    searchLane: "academic",
    sourceKind: "paper",
  };
}

function context(input) {
  return normalizeScriptPlannerEditorialContext({
    version: "0.10H-2E",
    editorialConstitution: "Preserve evidence, uncertainty, and source identity.",
    readiness: {
      status: "ready",
      editorialReadinessScore: 90,
      reviewReasons: [],
      primarySourceRequiredClaimIds: [],
      primarySourceCoveredClaimIds: [],
    },
    ...input,
  });
}

const memoryContext = context({
  claims: [
    {
      claimId: "memory-reconstruction",
      claimType: "RESEARCH_FINDING",
      text: "Remembering reconstructs prior experience rather than replaying a fixed record.",
      supportingEvidenceIds: ["e-reconstruction"],
      counterEvidenceIds: ["e-boundary"],
      contextualEvidenceIds: [],
    },
    {
      claimId: "post-event-information",
      claimType: "RESEARCH_FINDING",
      text: "Post-event information can alter later reports of an event.",
      supportingEvidenceIds: ["e-misinformation"],
      counterEvidenceIds: [],
      contextualEvidenceIds: [],
    },
    {
      claimId: "autobiographical-memory",
      claimType: "RESEARCH_FINDING",
      text: "Suggestion can contribute to false autobiographical recollection under studied conditions.",
      supportingEvidenceIds: ["e-autobiographical"],
      counterEvidenceIds: [],
      contextualEvidenceIds: ["e-boundary"],
    },
    {
      claimId: "identity-meaning",
      claimType: "EDITORIAL_INFERENCE",
      text: "The fallibility of memory raises a question about identity and self-narrative.",
      supportingEvidenceIds: [],
      counterEvidenceIds: [],
      contextualEvidenceIds: ["e-reconstruction"],
    },
    {
      claimId: "unsupported-philosophy",
      claimType: "EDITORIAL_INFERENCE",
      text: "An unbound implication must not masquerade as sourced evidence.",
      supportingEvidenceIds: [],
      counterEvidenceIds: [],
      contextualEvidenceIds: [],
    },
  ],
  evidence: [
    { evidenceId: "e-reconstruction", sourceId: "s-memory", excerpt: "Recall is reconstructive.", contextNote: null, locator },
    { evidenceId: "e-boundary", sourceId: "s-limits", excerpt: "Effects vary by conditions and procedure.", contextNote: "A documented boundary, not a generic limitation.", locator },
    { evidenceId: "e-misinformation", sourceId: "s-misinformation", excerpt: "Post-event information changed later reports.", contextNote: "   ", locator },
    { evidenceId: "e-autobiographical", sourceId: "s-autobiographical", excerpt: "Participants reported suggested autobiographical events.", contextNote: "Observed under the study's specific procedure.", locator },
  ],
  sources: [
    source("s-memory", "Reconstructive memory"),
    source("s-limits", "Boundaries of memory evidence", "secondary"),
    source("s-misinformation", "Post-event information study"),
    source("s-autobiographical", "Autobiographical suggestion study"),
  ],
});

assert.ok(memoryContext);
const memoryUnits = createCreatorEvidenceUnits(memoryContext);
assert.deepEqual(memoryUnits.map((unit) => unit.claimId), [
  "memory-reconstruction",
  "post-event-information",
  "autobiographical-memory",
  "identity-meaning",
]);
assert.equal(memoryUnits[0].supportingEvidence[0].sourceId, "s-memory");
assert.equal(memoryUnits[0].sourceRefs[0].url, "https://example.test/s-memory");
assert.equal(memoryUnits[0].counterEvidence[0].evidenceId, "e-boundary");
assert.equal(memoryUnits[1].supportingEvidence[0].contextNote, null);
assert.equal("limitation" in memoryUnits[1], false, "Missing limitations are not invented");
assert.equal(memoryUnits[3].epistemicStatus, "EDITORIAL_INFERENCE");
assert.equal(memoryUnits.some((unit) => unit.claimId === "unsupported-philosophy"), false);
assert.deepEqual(createCreatorEvidenceUnits(memoryContext), memoryUnits, "Equivalent input is stable");

const boundedMemory = buildCreatorEvidencePack({ context: memoryContext, maxUnits: 3 });
assert.deepEqual(boundedMemory.map((unit) => unit.claimId), memoryUnits.slice(0, 3).map((unit) => unit.claimId));
assert.equal(buildCreatorEvidencePack({ context: memoryContext, maxUnits: 20 }).length, 4, "Packing does not fill a quota");
assert.throws(
  () => buildCreatorEvidencePack({ context: memoryContext, maxUnits: -1 }),
  /CREATOR_EVIDENCE_PACK_LIMIT_INVALID/,
);

const memoryPromptPack = buildCreatorEvidencePromptPack({ context: memoryContext });
const memoryPromptPackCharacters = JSON.stringify(memoryPromptPack).length;
assert.equal(memoryPromptPack.length, 4, "Prompt packing does not fabricate a five-unit quota");
assert.deepEqual(buildCreatorEvidencePromptPack({ context: memoryContext }), memoryPromptPack, "Prompt projection is deterministic");
assert.equal(memoryPromptPack[0].supportingEvidence[0].evidenceId, "e-reconstruction");
assert.equal(memoryPromptPack[0].supportingEvidence[0].sourceId, "s-memory");
assert.equal(memoryPromptPack[0].counterEvidence[0].sourceId, "s-limits");
assert.deepEqual(memoryPromptPack[0].sourceRefs.map((item) => item.sourceId), ["s-memory", "s-limits"]);
assert.deepEqual(
  selectCreatorEvidencePromptPackForClaims({
    pack: memoryPromptPack,
    claimIds: ["post-event-information", "autobiographical-memory"],
  }).map((unit) => unit.claimId),
  ["post-event-information", "autobiographical-memory"],
  "Section-scoped evidence keeps canonical order and excludes foreign claims",
);
assert.deepEqual(selectCreatorEvidencePromptPackForClaims({ pack: memoryPromptPack, claimIds: [] }), []);
assert.equal("limitation" in memoryPromptPack[1], false, "Prompt projection does not synthesize unsupported limitations");
assert.equal("sampleSize" in memoryPromptPack[1], false, "Prompt projection does not synthesize study metadata");
assert.ok(memoryPromptPackCharacters < 8_000, "Memory evidence prompt delta remains compact");
assert.ok(memoryPromptPackCharacters <= CREATOR_EVIDENCE_PROMPT_PACK_MAX_CHARACTERS);
assert.deepEqual(buildCreatorEvidencePromptPack({ context: context({ claims: [], evidence: [], sources: [] }) }), [], "Empty evidence remains a safe empty prompt pack");

const concreteMomentExcerpt = "Researchers showed participants conflicting details after an event; the participants later reported details that were not in the original event.";
const concreteMomentContext = context({
  claims: [{
    claimId: "concrete-memory-demonstration",
    claimType: "RESEARCH_FINDING",
    text: "Post-event information can alter a later report.",
    supportingEvidenceIds: ["e-concrete-moment"],
    counterEvidenceIds: [],
    contextualEvidenceIds: [],
  }],
  evidence: [{
    evidenceId: "e-concrete-moment",
    sourceId: "s-concrete-moment",
    excerpt: concreteMomentExcerpt,
    contextNote: null,
    locator,
  }],
  sources: [source("s-concrete-moment", "Concrete memory observation")],
});
const concreteMomentPromptPack = buildCreatorEvidencePromptPack({ context: concreteMomentContext });
assert.equal(
  concreteMomentPromptPack[0].supportingEvidence[0].excerpt,
  concreteMomentExcerpt,
  "A concrete supplied procedure/result remains available for Section 3 narration",
);
assert.equal("sampleSize" in concreteMomentPromptPack[0], false);

const abstractMomentPromptPack = buildCreatorEvidencePromptPack({
  context: context({
    claims: [{
      claimId: "abstract-memory-framing",
      claimType: "THEORY",
      text: "Memory can be understood as reconstructive.",
      supportingEvidenceIds: ["e-abstract-moment"],
      counterEvidenceIds: [],
      contextualEvidenceIds: [],
    }],
    evidence: [{
      evidenceId: "e-abstract-moment",
      sourceId: "s-abstract-moment",
      excerpt: "Memory is reconstructive.",
      contextNote: null,
      locator,
    }],
    sources: [source("s-abstract-moment", "Abstract memory framing")],
  }),
});
assert.equal(abstractMomentPromptPack[0].supportingEvidence[0].excerpt, "Memory is reconstructive.");
assert.doesNotMatch(JSON.stringify(abstractMomentPromptPack), /participants|procedure|sample size/i);

const sourceMissing = structuredClone(memoryContext);
sourceMissing.sources = sourceMissing.sources.filter((item) => item.sourceId !== "s-misinformation");
assert.equal(
  createCreatorEvidenceUnits(sourceMissing).some((unit) => unit.claimId === "post-event-information"),
  false,
  "A missing source cannot become falsely grounded",
);

const workContext = context({
  claims: [
    {
      claimId: "work-task-change",
      claimType: "FORECAST",
      text: "Automation exposure may change task composition across occupations.",
      supportingEvidenceIds: ["e-work"],
      counterEvidenceIds: ["e-work-counter"],
      contextualEvidenceIds: [],
    },
  ],
  evidence: [
    { evidenceId: "e-work", sourceId: "s-work", excerpt: "Task exposure differs across occupations.", contextNote: "The estimate is a forecast, not an observed job-loss total.", locator },
    { evidenceId: "e-work-counter", sourceId: "s-work-counter", excerpt: "Adoption and employment effects remain uncertain.", contextNote: null, locator },
  ],
  sources: [
    source("s-work", "Automation and task exposure"),
    source("s-work-counter", "Employment counterview", "secondary"),
  ],
});

assert.ok(workContext);
const workUnits = createCreatorEvidenceUnits(workContext);
assert.equal(workUnits.length, 1);
assert.equal(workUnits[0].epistemicStatus, "FORECAST");
assert.equal(workUnits[0].supportingEvidence[0].evidenceId, "e-work");
assert.equal(workUnits[0].counterEvidence[0].evidenceId, "e-work-counter");
assert.deepEqual(workUnits[0].sourceRefs.map((item) => item.sourceId), ["s-work", "s-work-counter"]);
const workPromptPack = buildCreatorEvidencePromptPack({ context: workContext });
assert.equal(workPromptPack.length, 1);
assert.equal(workPromptPack[0].epistemicStatus, "FORECAST", "Cross-domain epistemic authority survives prompt projection");
assert.equal(workPromptPack[0].counterEvidence[0].evidenceId, "e-work-counter");
assert.match(workPromptPack[0].supportingEvidence[0].contextNote || "", /forecast, not an observed job-loss total/i);

console.log("CREATOR_EVIDENCE_PROMPT_PACK_DIAGNOSTICS", {
  memoryUnitCount: memoryPromptPack.length,
  memorySerializedCharacters: memoryPromptPackCharacters,
  crossDomainUnitCount: workPromptPack.length,
  crossDomainSerializedCharacters: JSON.stringify(workPromptPack).length,
});
console.log("STAGE_0_15B_EVIDENCE_OBJECT=PASS");
