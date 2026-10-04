import assert from "node:assert/strict";

import {
  createCreatorScriptSectionClaimAuthority,
} from "../lib/creator/creatorScriptBuildScriptGenerationCoordinator.ts";

function section(id, theme) {
  return {
    id,
    kind: "body",
    role: `role-${theme}`,
    centralQuestion: `question-${theme}`,
    progression: `progression-${theme}`,
    ownershipBoundary: {
      usage: "control_only_never_narrate",
      owns: ["approved_theme", `approved_theme:${theme}`],
      excludes: [],
    },
    minimumWords: 220,
    targetWords: 250,
    maximumWords: 280,
  };
}

const falsePositiveClaim = {
  claimId: "claim-future-work",
  claimType: "RESEARCH_FINDING",
  text: "AI and automation may displace a wide range of jobs.",
  supportingEvidenceIds: ["evidence-future-work"],
  counterEvidenceIds: [],
  contextualEvidenceIds: [],
};

const moneyClaim = {
  claimId: "claim-money",
  claimType: "EXPERT_OPINION",
  text: "If basic production becomes abundant, money may become less important for survival while scarce goods retain value.",
  supportingEvidenceIds: ["evidence-money"],
  counterEvidenceIds: [],
  contextualEvidenceIds: [],
};

const context = {
  version: "0.10H-2H",
  sourceVersion: "0.10H-2E",
  editorialConstitution: "documentary",
  readiness: {
    status: "ready",
    editorialReadinessScore: 100,
    reviewReasons: [],
    primarySourceRequiredClaimIds: [],
    primarySourceCoveredClaimIds: [],
  },
  claims: [falsePositiveClaim, moneyClaim],
  evidence: [
    {
      evidenceId: "evidence-future-work",
      sourceId: "source-future-work",
      excerpt:
        "The debate also raises questions of status, money, identity and meaning in a post-work society.",
      contextNote: "Broad topic framing only.",
      locator: {
        section: null,
        page: null,
        timecodeStartSec: null,
        timecodeEndSec: null,
      },
    },
    {
      evidenceId: "evidence-money",
      sourceId: "source-money",
      excerpt: "Abundance could change the economic role of money.",
      contextNote: null,
      locator: {
        section: null,
        page: null,
        timecodeStartSec: null,
        timecodeEndSec: null,
      },
    },
  ],
  sources: [
    {
      sourceId: "source-future-work",
      title: "Status, Money, Identity and Meaning After Work",
      url: "https://example.test/future-work",
      publisher: "Status and Money Review",
      author: null,
      publishedAt: null,
      directness: "secondary",
      reviewStatus: "usable",
      searchLane: "web",
      sourceKind: "article",
    },
    {
      sourceId: "source-money",
      title: "Economic abundance",
      url: "https://example.test/money",
      publisher: "Example",
      author: null,
      publishedAt: null,
      directness: "secondary",
      reviewStatus: "usable",
      searchLane: "web",
      sourceKind: "article",
    },
  ],
};

const authority = createCreatorScriptSectionClaimAuthority({
  editorialContext: context,
  sectionPlan: [
    section("section-1", "status"),
    section("section-2", "money"),
    section("section-3", "identity"),
    section("section-4", "meaning"),
  ],
  permittedClaimIds: ["claim-future-work", "claim-money"],
});

assert.equal(authority[0].mode, "conceptual_only");
assert.deepEqual(authority[0].permittedClaimIds, []);
assert.equal(authority[1].mode, "theme_grounded");
assert.deepEqual(authority[1].permittedClaimIds, ["claim-money"]);
assert.equal(authority[2].mode, "conceptual_only");
assert.deepEqual(authority[2].permittedClaimIds, []);
assert.equal(authority[3].mode, "conceptual_only");
assert.deepEqual(authority[3].permittedClaimIds, []);

console.log("stage-0-19f-f11-claim-text-theme-authority-test: PASS");
