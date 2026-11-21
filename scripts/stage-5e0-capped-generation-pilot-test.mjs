import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

import {
  createCreatorScriptSectionBudgetPlan,
} from "../lib/creator/creatorScript.ts";
import {
  createCreatorScriptBuildSectionEvidenceAuthorities,
} from "../lib/creator/creatorScriptBuildSectionEvidence.ts";
import {
  CREATOR_SCRIPT_GENERATION_PILOT_REQUEST_COUNT,
  executeOfflineCreatorScriptGenerationPilot,
} from "../lib/creator/creatorScriptGenerationPilotHarness.ts";
import { CREATOR_SCRIPT_BUILD_REPAIR_PROVIDER_POLICY_VERSION } from "../lib/creator/creatorScriptBuildRepairProviderPolicy.ts";
import * as creatorScript from "../lib/creator/creatorScript.ts";

const require = createRequire(import.meta.url);
const providerExports = {};
const providerCode = ts.transpileModule(
  readFileSync("lib/creator/creatorScriptBuildProviders.server.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
vm.runInNewContext(providerCode, {
  exports: providerExports,
  process: { env: {} },
  require: (name) => {
    if (name === "node:crypto") return require(name);
    if (name === "./creatorScript.ts") return creatorScript;
    if (name === "./creatorScriptBuildRepairProviderPolicy.ts") {
      return { CREATOR_SCRIPT_BUILD_REPAIR_PROVIDER_POLICY_VERSION };
    }
    return {};
  },
});
const { executeCreatorScriptBuildScriptGenerationProvider } = providerExports;

const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const locator = (page) => ({ section: null, page, timecodeStartSec: null, timecodeEndSec: null });
const source = (sourceId) => ({
  sourceId,
  title: `Synthetic independently verified source ${sourceId}`,
  url: `https://public.example.test/${sourceId}`,
  publisher: "Synthetic public publisher",
  author: "Synthetic author",
  publishedAt: "2026-01-01",
  directness: "primary",
  reviewStatus: "usable",
  searchLane: "academic",
  sourceKind: "paper",
});
const evidence = (evidenceId, sourceId, page) => ({
  evidenceId,
  sourceId,
  excerpt: `A bounded public observation for ${evidenceId} reports a documented measurement without extending its conclusion.`,
  contextNote: `Synthetic offline context for ${evidenceId}.`,
  locator: locator(page),
});
const claim = (claimId, claimType, evidenceId, extra = {}) => ({
  claimId,
  claimType,
  text: `Bounded synthetic claim ${claimId}`,
  supportingEvidenceIds: [evidenceId],
  counterEvidenceIds: extra.counterEvidenceIds || [],
  contextualEvidenceIds: extra.contextualEvidenceIds || [],
});

const sectionPlan = createCreatorScriptSectionBudgetPlan({
  targetDurationSec: 480,
  language: "en",
  narrativePolicy: "science_documentary_v1",
});
assert.deepEqual(sectionPlan.map((section) => section.ownershipBoundary.owns[1]), [
  "science_opening",
  "science_explanation",
  "science_empirical_evidence",
  "science_tension",
  "science_conclusion",
]);

const empiricalIds = Array.from({ length: 7 }, (_, index) => `empirical-${index + 1}`);
const claims = [
  claim("claim-opening", "FACT", "evidence-opening"),
  claim("claim-explanation", "THEORY", "evidence-explanation"),
  ...empiricalIds.map((id) => claim(`claim-${id}`, "RESEARCH_FINDING", `evidence-${id}`)),
  claim("claim-tension", "HYPOTHESIS", "evidence-tension", {
    contextualEvidenceIds: ["evidence-limitation"],
  }),
  claim("claim-conclusion", "EDITORIAL_INFERENCE", "evidence-conclusion"),
];
const evidenceItems = [
  evidence("evidence-opening", "source-opening", 1),
  evidence("evidence-explanation", "source-explanation", 2),
  ...empiricalIds.map((id, index) => evidence(`evidence-${id}`, `source-${id}`, index + 3)),
  evidence("evidence-tension", "source-tension", 10),
  evidence("evidence-limitation", "source-tension", 11),
  evidence("evidence-conclusion", "source-conclusion", 12),
];
const sources = [...new Set(evidenceItems.map((item) => item.sourceId))].map(source);
const context = {
  version: "0.10H-2H",
  sourceVersion: "0.10H-2E",
  editorialConstitution: "Synthetic public evidence remains source- and section-bound.",
  readiness: {
    status: "ready",
    editorialReadinessScore: 100,
    reviewReasons: [],
    primarySourceRequiredClaimIds: [],
    primarySourceCoveredClaimIds: [],
  },
  claims,
  evidence: evidenceItems,
  sources,
};
const routing = [
  { sectionId: "opening", sectionKind: "opening", semanticRole: "opening", claimIds: ["claim-opening"], evidenceIds: ["evidence-opening"], usedFallback: false },
  { sectionId: "section-1", sectionKind: "body", semanticRole: "explanation", claimIds: ["claim-explanation"], evidenceIds: ["evidence-explanation"], usedFallback: false },
  { sectionId: "section-2", sectionKind: "body", semanticRole: "empirical_evidence", claimIds: empiricalIds.map((id) => `claim-${id}`), evidenceIds: empiricalIds.map((id) => `evidence-${id}`), usedFallback: false },
  { sectionId: "section-3", sectionKind: "body", semanticRole: "scientific_tension", claimIds: ["claim-tension"], evidenceIds: ["evidence-tension", "evidence-limitation"], usedFallback: false },
  { sectionId: "conclusion", sectionKind: "conclusion", semanticRole: "conclusion", claimIds: ["claim-conclusion"], evidenceIds: ["evidence-conclusion"], usedFallback: false },
];
const authorities = createCreatorScriptBuildSectionEvidenceAuthorities({
  context,
  sectionPlan,
  sectionClaimRouting: routing,
});
assert.equal(authorities.length, 5);
assert.equal(authorities[2].selection.units.length, 5);
assert.equal(authorities[2].selection.metrics.omissionReasonCounts.unit_budget, 2);
assert.ok(authorities.every((authority) => JSON.stringify(authority.selection.units).length <= 12_000));

const generationInput = {
  version: "0.19E3A-script-generation-request-v1",
  topic: "Synthetic public science question",
  researchSubject: "Synthetic public science question",
  title: "Synthetic evidence-driven documentary",
  contentType: "documentary",
  narrativePolicy: "science_documentary_v1",
  format: "youtube_video",
  language: "en",
  requestedDurationSeconds: 480,
  strategyFingerprint: sha256("stage-5e0-synthetic-strategy"),
  approvedStrategy: { version: "synthetic-stage-5e0" },
  creatorProfile: { version: "synthetic-stage-5e0" },
  sectionPlan,
  sectionNative: true,
  longFormEvidenceReadiness: {
    applicable: true,
    eligible: true,
    reasonCodes: [],
    fallbackBodySectionIds: [],
    collapsedBodySectionIds: [],
    evidenceDependentBodySectionIds: ["section-1", "section-2", "section-3"],
  },
  sectionClaimRouting: routing,
  sectionEvidenceAuthorities: authorities,
  editorialContext: context,
  permittedClaimIds: claims.map((item) => item.claimId),
};
const fixture = {
  version: "stage-5e0-public-evidence-fixture-v1",
  fixtureId: "synthetic-public-only-stage-5e0",
  generationInput,
  sourceVerifications: sources.map((item) => ({
    sourceId: item.sourceId,
    canonicalUrl: item.url,
    documentSha256: sha256(`document:${item.sourceId}`),
    verificationMethod: "owner_verified_public_document",
  })),
  evidenceVerifications: evidenceItems.map((item) => ({
    evidenceId: item.evidenceId,
    sourceId: item.sourceId,
    passageSha256: sha256(item.excerpt),
    locatorFingerprintSha256: sha256(JSON.stringify(item.locator)),
  })),
};
const envelope = {
  model: "gpt-6.1-sol",
  maximumProviderRequests: 5,
  maximumAttemptsPerRequest: 1,
  maximumInputTokensPerRequest: 20_000,
  maximumOutputTokensPerRequest: 2_000,
  maximumCostUsd: 0.3,
  pricing: {
    model: "gpt-6.1-sol",
    currency: "USD",
    inputUsdPerMillionTokens: 2,
    outputUsdPerMillionTokens: 10,
    source: "offline-test-price-fixture",
    verifiedAt: "2026-10-25",
  },
};
const captured = [];
let networkAttempted = false;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  networkAttempted = true;
  throw new Error("NETWORK_FORBIDDEN");
};
const mockTransport = async ({ request, controls }) => {
  captured.push(structuredClone({ request, controls }));
  return {
    status: "completed",
    requestId: `mock-request-${controls.requestOrdinal}`,
    attemptCount: 1,
    inputTokens: Math.ceil(JSON.stringify(request).length / 4),
    outputTokens: 80,
    output: {
      heading: null,
      text: `Synthetic non-persisted narration for section ${controls.requestOrdinal}.`,
      claimIds: [],
    },
  };
};
const countInputTokens = (request) => Math.ceil(JSON.stringify(request).length / 4);
const runPilot = (overrides = {}) => executeOfflineCreatorScriptGenerationPilot({
  fixture,
  envelope,
  ownerId: "isolated-owner-stage-5e0",
  projectId: "isolated-project-stage-5e0",
  liveProviderAccess: false,
  countInputTokens,
  mockTransport,
  executeGeneration: executeCreatorScriptBuildScriptGenerationProvider,
  ...overrides,
});

try {
  const result = await runPilot();
  assert.equal(result.providerRequestCount, CREATOR_SCRIPT_GENERATION_PILOT_REQUEST_COUNT);
  assert.equal(result.requests.length, 5);
  assert.equal(result.persistence, "none");
  assert.equal(result.durationAuthority, "estimated_words_only");
  assert.equal(result.maximumReservedCostUsd, 0.3);
  assert.equal(result.actualMockUsage.outputTokens, 400);
  assert.equal(networkAttempted, false);
  assert.equal(captured.length, 5);
  for (const [index, capture] of captured.entries()) {
    const authority = authorities[index];
    assert.equal(capture.controls.maxRetries, 0);
    assert.equal(capture.controls.maxOutputTokens, 2_000);
    assert.equal(capture.controls.model, "gpt-6.1-sol");
    assert.equal(capture.request.user.activeSection.id, sectionPlan[index].id);
    assert.deepEqual(capture.request.user.activeSectionEvidenceSelection, authority.selection);
    assert.deepEqual(capture.request.user.activeSectionClaimAuthority.claimIds, authority.claimIds);
    assert.deepEqual(capture.request.user.activeSectionClaimAuthority.evidenceIds, authority.evidenceIds);
    assert.equal(Object.hasOwn(capture.request.user.generationAuthority, "editorialContext"), false);
    assert.equal(Object.hasOwn(capture.request.user.generationAuthority, "sectionClaimRouting"), false);
    assert.equal(Object.hasOwn(capture.request.user.generationAuthority, "sectionEvidenceAuthorities"), false);
    const serialized = JSON.stringify(capture.request.user);
    const unrelatedEvidence = authorities
      .filter((item) => item.sectionId !== authority.sectionId)
      .flatMap((item) => item.evidenceIds);
    assert.ok(unrelatedEvidence.every((evidenceId) => !serialized.includes(`\"${evidenceId}\"`)));
  }
  assert.equal(JSON.stringify(captured[2]).includes("claim-empirical-6"), false);
  assert.equal(JSON.stringify(captured[2]).includes("claim-empirical-7"), false);

  await assert.rejects(
    runPilot({ countInputTokens: () => 20_001 }),
    /CREATOR_SCRIPT_GENERATION_PILOT_INPUT_TOKEN_LIMIT_EXCEEDED/,
  );
  await assert.rejects(
    runPilot({ envelope: { ...envelope, pricing: { ...envelope.pricing, source: "" } } }),
    /CREATOR_SCRIPT_GENERATION_PILOT_PRICING_MISSING/,
  );
  await assert.rejects(
    runPilot({ envelope: { ...envelope, model: "unexpected-model" } }),
    /CREATOR_SCRIPT_GENERATION_PILOT_MODEL_OR_PRICING_MISSING/,
  );
  await assert.rejects(
    runPilot({ liveProviderAccess: true }),
    /CREATOR_SCRIPT_GENERATION_PILOT_LIVE_PROVIDER_DISABLED/,
  );
  await assert.rejects(
    runPilot({ envelope: { ...envelope, maximumCostUsd: 0.299 } }),
    /CREATOR_SCRIPT_GENERATION_PILOT_BUDGET_EXHAUSTED/,
  );
  await assert.rejects(
    runPilot({ fixture: { ...fixture, sourceVerifications: fixture.sourceVerifications.slice(1) } }),
    /CREATOR_SCRIPT_GENERATION_PILOT_SOURCE_PROVENANCE_MISSING/,
  );
  await assert.rejects(
    runPilot({
      fixture: {
        ...fixture,
        evidenceVerifications: fixture.evidenceVerifications.map((item, index) =>
          index === 0 ? { ...item, passageSha256: sha256("substituted passage") } : item
        ),
      },
    }),
    /CREATOR_SCRIPT_GENERATION_PILOT_EVIDENCE_PROVENANCE_INVALID/,
  );
  await assert.rejects(
    runPilot({
      mockTransport: async ({ controls }) => ({
        status: "completed",
        requestId: `oversized-${controls.requestOrdinal}`,
        attemptCount: 1,
        inputTokens: 1,
        outputTokens: 2_001,
        output: {},
      }),
    }),
    /CREATOR_SCRIPT_GENERATION_PILOT_PROVIDER_USAGE_INVALID/,
  );
  await assert.rejects(
    runPilot({
      mockTransport: async () => ({
        status: "ambiguous",
        requestId: null,
        attemptCount: 1,
        inputTokens: 0,
        outputTokens: 0,
        output: null,
      }),
    }),
    /CREATOR_SCRIPT_GENERATION_PILOT_PROVIDER_COMPLETION_AMBIGUOUS/,
  );
  await assert.rejects(
    runPilot({
      mockTransport: async ({ controls }) => ({
        status: "completed",
        requestId: "duplicate-request-id",
        attemptCount: 1,
        inputTokens: 1,
        outputTokens: 1,
        output: { heading: null, text: `Section ${controls.requestOrdinal}`, claimIds: [] },
      }),
    }),
    /CREATOR_SCRIPT_GENERATION_PILOT_DUPLICATE_REQUEST/,
  );
  await assert.rejects(
    runPilot({
      executeGeneration: async (input) => {
        const request = {
          ownerId: input.ownerId,
          projectId: input.projectId,
          operationType: "creator_script_build_script_generation",
          logicalOperationId: "duplicate-logical-operation",
          system: "synthetic",
          user: { activeSection: { id: "opening" } },
          schemaName: "synthetic",
          schema: {},
          model: "gpt-6.1-sol",
        };
        await input.runJson(request);
        await input.runJson(request);
        return {};
      },
    }),
    /CREATOR_SCRIPT_GENERATION_PILOT_DUPLICATE_REQUEST/,
  );
  await assert.rejects(
    runPilot({
      executeGeneration: async (input) => {
        for (let index = 0; index < 6; index += 1) {
          await input.runJson({
            ownerId: input.ownerId,
            projectId: input.projectId,
            operationType: "creator_script_build_script_generation",
            logicalOperationId: `extra-operation-${index}`,
            system: "synthetic",
            user: { activeSection: { id: `section-${index}` } },
            schemaName: "synthetic",
            schema: {},
            model: "gpt-6.1-sol",
          });
        }
        return {};
      },
    }),
    /CREATOR_SCRIPT_GENERATION_PILOT_REQUEST_LIMIT_EXCEEDED/,
  );
} finally {
  globalThis.fetch = originalFetch;
}

const harnessSource = readFileSync("lib/creator/creatorScriptGenerationPilotHarness.ts", "utf8");
assert.doesNotMatch(harnessSource, /from ["'](?:@supabase|openai|\.\/creatorScriptBuildProviders)/);
assert.doesNotMatch(harnessSource, /fetch\s*\(|creator-script-build\/route|save-project|store-audio|export-movie/);

console.log("STAGE_5E0_CAPPED_GENERATION_PILOT=PASS");
console.log("STAGE_5E0_PROVIDER_REQUESTS=5");
console.log("STAGE_5E0_EXECUTION_MODE=INJECTED_MOCK");
console.log("STAGE_5E0_OBSERVED_FETCH_REQUESTS=0");
console.log("STAGE_5E0_DATABASE_WRITES=0");
