import assert from "node:assert/strict";
import fs from "node:fs";

import {
  createCreatorScriptSectionClaimAuthority,
} from "../lib/creator/creatorScriptBuildScriptGenerationCoordinator.ts";

function section(id, kind, owns) {
  return {
    id,
    kind,
    role: `role-${id}`,
    centralQuestion: `question-${id}`,
    progression: `progression-${id}`,
    ownershipBoundary: {
      usage: "control_only_never_narrate",
      owns,
      excludes: [],
    },
    minimumWords: kind === "body" ? 220 : 100,
    targetWords: kind === "body" ? 250 : 120,
    maximumWords: kind === "body" ? 280 : 140,
  };
}

const sectionPlan = [
  section("opening", "opening", ["human_stakes"]),
  section("section-1", "body", ["definition", "approved_theme", "approved_theme:status"]),
  section("section-2", "body", ["mechanism", "approved_theme", "approved_theme:money"]),
  section("section-3", "body", ["grounded_synthesis", "approved_theme", "approved_theme:identity"]),
  section("section-4", "body", ["grounded_tension", "approved_theme", "approved_theme:meaning"]),
  section("conclusion", "conclusion", ["highest_order_implication"]),
];

const claims = [
  {
    claimId: "claim-money-abundance",
    claimType: "FACT",
    text: "AI and robots could create enough abundance that money becomes less relevant for labor allocation.",
    supportingEvidenceIds: ["evidence-money"],
    counterEvidenceIds: [],
    contextualEvidenceIds: [],
  },
  {
    claimId: "claim-money-optionality",
    claimType: "FACT",
    text: "A work-optional future could make money less central to economic survival.",
    supportingEvidenceIds: ["evidence-optionality"],
    counterEvidenceIds: [],
    contextualEvidenceIds: [],
  },
  {
    claimId: "claim-automation-history",
    claimType: "FACT",
    text: "Historical automation has often reallocated paid work rather than eliminated it.",
    supportingEvidenceIds: ["evidence-history"],
    counterEvidenceIds: [],
    contextualEvidenceIds: [],
  },
  {
    claimId: "claim-conditions",
    claimType: "FACT",
    text: "Work optionality requires high output, reliable distribution, and institutional stability.",
    supportingEvidenceIds: ["evidence-conditions"],
    counterEvidenceIds: [],
    contextualEvidenceIds: [],
  },
];

const editorialContext = {
  version: "0.10H-2H",
  sourceVersion: "0.10H-2E",
  editorialConstitution: "documentary",
  readiness: {
    status: "ready",
    editorialReadinessScore: 90,
    reviewReasons: [],
    primarySourceRequiredClaimIds: [],
    primarySourceCoveredClaimIds: [],
  },
  claims,
  evidence: [
    {
      evidenceId: "evidence-money",
      sourceId: "source-money",
      excerpt: "Money may become less relevant when production becomes abundant.",
      contextNote: "Economic allocation.",
      locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
    },
    {
      evidenceId: "evidence-optionality",
      sourceId: "source-money",
      excerpt: "Money and paid work may become less central to survival.",
      contextNote: null,
      locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
    },
    {
      evidenceId: "evidence-history",
      sourceId: "source-history",
      excerpt: "Automation historically shifted employment across occupations.",
      contextNote: null,
      locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
    },
    {
      evidenceId: "evidence-conditions",
      sourceId: "source-conditions",
      excerpt: "Output, distribution, and institutions determine whether work can become optional.",
      contextNote: null,
      locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
    },
  ],
  sources: [
    {
      sourceId: "source-money",
      title: "Future of money",
      url: "https://example.test/money",
      publisher: "Example",
      author: null,
      publishedAt: null,
      directness: "secondary",
      reviewStatus: "usable",
      searchLane: "web",
      sourceKind: "article",
    },
    {
      sourceId: "source-history",
      title: "Automation history",
      url: "https://example.test/history",
      publisher: "Example",
      author: null,
      publishedAt: null,
      directness: "secondary",
      reviewStatus: "usable",
      searchLane: "web",
      sourceKind: "article",
    },
    {
      sourceId: "source-conditions",
      title: "Conditions for work optionality",
      url: "https://example.test/conditions",
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

const permittedClaimIds = claims.map((claim) => claim.claimId);
const authority = createCreatorScriptSectionClaimAuthority({
  editorialContext,
  sectionPlan,
  permittedClaimIds,
});

assert.deepEqual(authority.map((item) => item.sectionId), sectionPlan.map((item) => item.id));
assert.deepEqual(authority[0].permittedClaimIds, permittedClaimIds);
assert.equal(authority[0].mode, "global_grounded");

assert.equal(authority[1].themeToken, "status");
assert.equal(authority[1].mode, "conceptual_only");
assert.deepEqual(authority[1].permittedClaimIds, []);

assert.equal(authority[2].themeToken, "money");
assert.equal(authority[2].mode, "theme_grounded");
assert.deepEqual(
  authority[2].permittedClaimIds,
  ["claim-money-abundance", "claim-money-optionality"],
);

assert.equal(authority[3].themeToken, "identity");
assert.equal(authority[3].mode, "conceptual_only");
assert.deepEqual(authority[3].permittedClaimIds, []);

assert.equal(authority[4].themeToken, "meaning");
assert.equal(authority[4].mode, "conceptual_only");
assert.deepEqual(authority[4].permittedClaimIds, []);

assert.equal(authority[5].mode, "conceptual_only");
assert.deepEqual(authority[5].permittedClaimIds, []);

const evidenceMatched = createCreatorScriptSectionClaimAuthority({
  editorialContext: {
    ...editorialContext,
    claims: [{
      claimId: "claim-self-concept",
      claimType: "FACT",
      text: "Professional roles can shape personal identity and self-concept.",
      supportingEvidenceIds: ["evidence-identity"],
      counterEvidenceIds: [],
      contextualEvidenceIds: [],
    }],
    evidence: [{
      evidenceId: "evidence-identity",
      sourceId: "source-identity",
      excerpt: "Occupational identity can become a major part of personal identity.",
      contextNote: null,
      locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
    }],
    sources: [{
      sourceId: "source-identity",
      title: "Occupational roles and identity",
      url: "https://example.test/identity",
      publisher: "Example",
      author: null,
      publishedAt: null,
      directness: "secondary",
      reviewStatus: "usable",
      searchLane: "web",
      sourceKind: "article",
    }],
  },
  sectionPlan,
  permittedClaimIds: ["claim-self-concept"],
});
assert.deepEqual(evidenceMatched[3].permittedClaimIds, ["claim-self-concept"]);
assert.equal(evidenceMatched[3].mode, "theme_grounded");

const provider = fs.readFileSync(
  new URL("../lib/creator/creatorScriptBuildProviders.server.ts", import.meta.url),
  "utf8",
);
assert.match(provider, /sectionClaimAuthority is binding evidence authority/u);
assert.match(provider, /conceptual_only/u);
assert.match(provider, /generationSectionSchema\(input\.value, activeSection\.id\)/u);
assert.match(provider, /claimIdArraySchema/u);
assert.match(provider, /maxItems: 0/u);

const repair = fs.readFileSync(
  new URL("../lib/creator/creatorScriptBuildScriptRepairCoordinator.ts", import.meta.url),
  "utf8",
);
assert.match(repair, /createCreatorScriptSectionClaimAuthority/u);
assert.match(repair, /allowedClaimIdsForRepairSection/u);
assert.match(repair, /sectionClaimAuthority/u);

console.log("stage-0-19f-f8-theme-aware-section-claim-authority-test: PASS");
