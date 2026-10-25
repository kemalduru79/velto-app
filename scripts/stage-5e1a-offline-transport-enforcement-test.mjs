import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

import * as creatorScript from "../lib/creator/creatorScript.ts";
import { createCreatorScriptSectionBudgetPlan } from "../lib/creator/creatorScript.ts";
import {
  createCreatorScriptBuildSectionEvidenceAuthorities,
} from "../lib/creator/creatorScriptBuildSectionEvidence.ts";
import {
  executeOfflineCreatorScriptGenerationPilot,
} from "../lib/creator/creatorScriptGenerationPilotHarness.ts";
import {
  STAGE_5E1A_MAXIMUM_COST_USD,
  STAGE_5E1A_MAXIMUM_OUTPUT_TOKENS_PER_REQUEST,
  STAGE_5E1A_PINNED_MODEL,
  STAGE_5E1A_RESPONSES_ENDPOINT,
  calculateStage5e1aWorstCaseCostUsd,
  createStage5e1aOfflineEnvelope,
  createStage5e1aOfflineTransport,
  requestInputFingerprintSha256,
  stage5e1aRequestFingerprintSha256,
} from "../lib/creator/creatorScriptGenerationPilotOfflineTransport.ts";
import { CREATOR_SCRIPT_BUILD_REPAIR_PROVIDER_POLICY_VERSION } from "../lib/creator/creatorScriptBuildRepairProviderPolicy.ts";

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

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const locator = (page) => ({ section: null, page, timecodeStartSec: null, timecodeEndSec: null });
const documentBytesBySourceId = new Map();
const source = (sourceId) => {
  documentBytesBySourceId.set(sourceId, Buffer.from(`synthetic-public-document:${sourceId}`));
  return {
    sourceId,
    title: `Synthetic public source ${sourceId}`,
    url: `https://publisher.example.test/${sourceId}`,
    publisher: "Synthetic publisher",
    author: "Synthetic author",
    publishedAt: "2026-01-01",
    directness: "primary",
    reviewStatus: "usable",
    searchLane: "academic",
    sourceKind: "paper",
  };
};
const evidence = (evidenceId, sourceId, page) => ({
  evidenceId,
  sourceId,
  excerpt: `Synthetic verified observation ${evidenceId} with a bounded quantitative finding.`,
  contextNote: `Synthetic limitation context ${evidenceId}.`,
  locator: locator(page),
});
const claim = (claimId, claimType, supportingEvidenceIds, options = {}) => ({
  claimId,
  claimType,
  text: `Synthetic bounded claim ${claimId}`,
  supportingEvidenceIds,
  counterEvidenceIds: options.counterEvidenceIds || [],
  contextualEvidenceIds: options.contextualEvidenceIds || [],
});

const sectionPlan = createCreatorScriptSectionBudgetPlan({
  targetDurationSec: 480,
  language: "en",
  narrativePolicy: "science_documentary_v1",
});
const empiricalIds = Array.from({ length: 7 }, (_, index) => `empirical-${index + 1}`);
const evidenceItems = [
  evidence("evidence-opening", "source-opening", 1),
  evidence("evidence-explanation", "source-explanation", 2),
  ...empiricalIds.map((id, index) => evidence(`evidence-${id}`, `source-${id}`, index + 3)),
  evidence("evidence-tension", "source-tension", 10),
  evidence("evidence-limitation", "source-tension", 11),
  evidence("evidence-conclusion", "source-conclusion", 12),
];
const sources = [...new Set(evidenceItems.map((item) => item.sourceId))].map(source);
const claims = [
  claim("claim-opening", "FACT", ["evidence-opening"]),
  claim("claim-explanation", "THEORY", ["evidence-explanation"]),
  ...empiricalIds.map((id) => claim(`claim-${id}`, "RESEARCH_FINDING", [`evidence-${id}`])),
  claim("claim-tension", "HYPOTHESIS", ["evidence-tension"], {
    contextualEvidenceIds: ["evidence-limitation"],
  }),
  claim("claim-conclusion", "EDITORIAL_INFERENCE", ["evidence-conclusion"]),
];
const context = {
  version: "0.10H-2H",
  sourceVersion: "0.10H-2E",
  editorialConstitution: "Synthetic evidence remains public, verified, and section-bound.",
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
const generationInput = {
  version: "0.19E3A-script-generation-request-v1",
  topic: "Synthetic public science topic",
  researchSubject: "Synthetic public science topic",
  title: "Synthetic science documentary",
  contentType: "documentary",
  narrativePolicy: "science_documentary_v1",
  format: "youtube_video",
  language: "en",
  requestedDurationSeconds: 480,
  strategyFingerprint: sha256("stage-5e1a-strategy"),
  approvedStrategy: { version: "synthetic-stage-5e1a" },
  creatorProfile: { version: "synthetic-stage-5e1a" },
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
  fixtureId: "synthetic-stage-5e1a-public-fixture",
  generationInput,
  sourceVerifications: sources.map((item) => ({
    sourceId: item.sourceId,
    canonicalUrl: item.url,
    documentSha256: sha256(documentBytesBySourceId.get(item.sourceId)),
    verificationMethod: "owner_verified_public_document",
  })),
  evidenceVerifications: evidenceItems.map((item) => ({
    evidenceId: item.evidenceId,
    sourceId: item.sourceId,
    passageSha256: sha256(item.excerpt),
    locatorFingerprintSha256: sha256(JSON.stringify(item.locator)),
  })),
};
const offlineEnvelope = createStage5e1aOfflineEnvelope();
assert.equal(calculateStage5e1aWorstCaseCostUsd(offlineEnvelope), 1.65);
assert.equal(offlineEnvelope.model, "gpt-6.1-sol");
assert.equal(offlineEnvelope.serviceTier, "default");
assert.equal(offlineEnvelope.maximumAttempts, 5);
assert.equal(offlineEnvelope.maximumOutputTokensPerRequest, 25_000);

const harnessEnvelope = {
  model: STAGE_5E1A_PINNED_MODEL,
  maximumProviderRequests: 5,
  maximumAttemptsPerRequest: 1,
  maximumInputTokensPerRequest: 20_000,
  maximumOutputTokensPerRequest: STAGE_5E1A_MAXIMUM_OUTPUT_TOKENS_PER_REQUEST,
  maximumCostUsd: STAGE_5E1A_MAXIMUM_COST_USD,
  pricing: {
    model: STAGE_5E1A_PINNED_MODEL,
    currency: "USD",
    inputUsdPerMillionTokens: 2,
    outputUsdPerMillionTokens: 10,
    source: "openai-official-pricing-2026-10-25",
    verifiedAt: "2026-10-25",
  },
};
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "velto-stage5e1a-"));
await chmod(temporaryRoot, 0o700);
let runSequence = 0;
const nextPrivateRoot = async () => {
  const privateRootDirectory = path.join(temporaryRoot, `private-root-${++runSequence}`);
  await mkdir(privateRootDirectory, { mode: 0o700 });
  return privateRootDirectory;
};
const tokenAdmissions = [];
const verifiedTokenCounter = (request) => {
  const inputTokensUpperBound = Buffer.byteLength(JSON.stringify({
    input: request.body.input,
    text: request.body.text,
  }), "utf8") / 4 + 1_024;
  const admission = {
    model: STAGE_5E1A_PINNED_MODEL,
    requestInputFingerprintSha256: requestInputFingerprintSha256(request),
    inputTokensUpperBound: Math.ceil(inputTokensUpperBound),
    assurance: "model_compatible_verified_upper_bound",
    method: "synthetic-model-compatible-upper-bound-v1",
  };
  tokenAdmissions.push(admission);
  return admission;
};
const validReceipt = (request, ordinal = 1) => ({
  status: "completed",
  endpoint: STAGE_5E1A_RESPONSES_ENDPOINT,
  model: STAGE_5E1A_PINNED_MODEL,
  serviceTier: "default",
  requestFingerprintSha256: stage5e1aRequestFingerprintSha256(request),
  responseId: `mock-response-${ordinal}-${sha256(JSON.stringify(request)).slice(0, 8)}`,
  attemptCount: 1,
  completionStatus: "completed",
  usage: {
    inputTokens: Math.min(verifiedTokenCounter(request).inputTokensUpperBound, 19_000),
    outputTokens: 500,
  },
  output: {
    heading: null,
    text: `Synthetic completed section ${ordinal} with no persistence.`,
    claimIds: [],
  },
  observedNetworkDestinations: [],
});
const createTransport = async (overrides = {}) => {
  const privateRootDirectory = overrides.privateRootDirectory || await nextPrivateRoot();
  const dispatcher = overrides.mockDispatcher || (async (request) =>
    validReceipt(request, overrides.ordinal || 1)
  );
  const created = await createStage5e1aOfflineTransport({
    runId: overrides.runId || `synthetic-run-${runSequence + 1}`,
    privateRootDirectory,
    fixture: overrides.fixture || fixture,
    publicDocumentBytes: overrides.publicDocumentBytes || documentBytesBySourceId,
    envelope: overrides.envelope || offlineEnvelope,
    tokenCounter: overrides.tokenCounter || verifiedTokenCounter,
    mockDispatcher: dispatcher,
    liveProviderAccess: overrides.liveProviderAccess ?? false,
  });
  return { ...created, privateRootDirectory };
};

const capturedRequests = [];
const success = await createTransport({
  runId: "stage-5e1a-success",
  mockDispatcher: async (request) => {
    capturedRequests.push(structuredClone(request));
    return validReceipt(request, capturedRequests.length);
  },
});
const pilot = await executeOfflineCreatorScriptGenerationPilot({
  fixture,
  envelope: harnessEnvelope,
  ownerId: "synthetic-owner-stage-5e1a",
  projectId: "synthetic-project-stage-5e1a",
  liveProviderAccess: false,
  countInputTokens: (request) => Math.ceil(Buffer.byteLength(JSON.stringify(request), "utf8") / 4),
  mockTransport: success.transport,
  executeGeneration: executeCreatorScriptBuildScriptGenerationProvider,
});
assert.equal(pilot.providerRequestCount, 5);
assert.equal(success.reservedCostUsd, 1.65);
assert.equal(capturedRequests.length, 5);
assert.equal(new Set(capturedRequests.map(requestInputFingerprintSha256)).size, 5);
for (const request of capturedRequests) {
  assert.equal(request.endpoint, "https://api.openai.com/v1/responses");
  assert.equal(request.body.model, "gpt-6.1-sol");
  assert.equal(request.body.service_tier, "default");
  assert.equal(request.body.max_output_tokens, 25_000);
  assert.equal(request.requestOptions.maxRetries, 0);
  assert.deepEqual(request.body.tools, []);
  assert.equal(request.body.store, false);
  assert.equal(request.body.background, false);
  assert.equal(request.body.text.format.type, "json_schema");
  assert.ok(request.body.text.format.schema);
}
const lastUserPayload = JSON.parse(capturedRequests[4].body.input[1].content);
assert.equal(lastUserPayload.completedSections.length, 4);
assert.ok(tokenAdmissions.length >= 5);

const ledgerFiles = await readdir(success.ledgerDirectory);
assert.equal(ledgerFiles.filter((item) => /^attempt-\d{2}\.json$/.test(item)).length, 5);
assert.equal(ledgerFiles.filter((item) => /^outcome-\d{2}\.json$/.test(item)).length, 5);
const manifest = JSON.parse(await readFile(path.join(success.ledgerDirectory, "manifest.json"), "utf8"));
assert.equal(manifest.maximumAttempts, 5);
assert.equal(manifest.reservedCostUsd, 1.65);

const directRequest = (logicalOperationId, sectionId = "opening") => ({
  ownerId: "synthetic-owner",
  projectId: "synthetic-project",
  operationType: "creator_script_build_script_generation",
  logicalOperationId,
  system: "Synthetic system instruction.",
  user: { activeSection: { id: sectionId }, completedSections: [] },
  schemaName: "synthetic_section",
  schema: { type: "object", properties: {}, additionalProperties: false },
  model: STAGE_5E1A_PINNED_MODEL,
  reasoningEffort: "medium",
});
const controls = {
  model: STAGE_5E1A_PINNED_MODEL,
  maxOutputTokens: 25_000,
  maxRetries: 0,
  requestOrdinal: 1,
};

const duplicate = await createTransport({ runId: "duplicate-dispatch" });
await duplicate.transport({ request: directRequest("same-logical-id"), controls });
await assert.rejects(
  duplicate.transport({ request: directRequest("same-logical-id"), controls }),
  /STAGE_5E1A_DUPLICATE_DISPATCH/,
);

const timeout = await createTransport({
  runId: "timeout-consumes-attempt",
  mockDispatcher: async (request) => ({
    ...validReceipt(request),
    status: "timeout",
    responseId: null,
    completionStatus: null,
    usage: null,
    output: null,
  }),
});
await assert.rejects(
  timeout.transport({ request: directRequest("timeout-operation"), controls }),
  /STAGE_5E1A_PROVIDER_COMPLETION_AMBIGUOUS/,
);
await assert.rejects(
  timeout.transport({ request: directRequest("timeout-operation"), controls }),
  /STAGE_5E1A_RUN_BLOCKED_AMBIGUOUS/,
);
await assert.rejects(
  timeout.transport({ request: directRequest("different-operation-after-timeout"), controls }),
  /STAGE_5E1A_RUN_BLOCKED_AMBIGUOUS/,
);
assert.equal((await readdir(timeout.ledgerDirectory)).filter((item) => item.startsWith("attempt-")).length, 1);

let releasePendingDispatch;
let markPendingDispatchEntered;
const pendingDispatchEntered = new Promise((resolve) => {
  markPendingDispatchEntered = resolve;
});
const releasePending = new Promise((resolve) => {
  releasePendingDispatch = resolve;
});
const concurrentRoot = await nextPrivateRoot();
const concurrent = await createTransport({
  privateRootDirectory: concurrentRoot,
  runId: "concurrent-process-protection",
  mockDispatcher: async (request) => {
    markPendingDispatchEntered();
    await releasePending;
    return validReceipt(request);
  },
});
const pendingDispatch = concurrent.transport({
  request: directRequest("pending-first-operation"),
  controls,
});
await pendingDispatchEntered;
const competingProcess = await createTransport({
  privateRootDirectory: concurrentRoot,
  runId: "concurrent-process-protection",
});
await assert.rejects(
  competingProcess.transport({
    request: directRequest("competing-operation"),
    controls,
  }),
  /STAGE_5E1A_RUN_BLOCKED_AMBIGUOUS/,
);
releasePendingDispatch();
await pendingDispatch;
assert.equal(
  (await readdir(concurrent.ledgerDirectory)).filter((item) => item.startsWith("attempt-")).length,
  1,
);

const corruptRoot = await nextPrivateRoot();
const corrupt = await createTransport({
  privateRootDirectory: corruptRoot,
  runId: "interrupted-marker-write",
});
await writeFile(path.join(corrupt.ledgerDirectory, "attempt-01.json"), "{", { mode: 0o600 });
await assert.rejects(
  corrupt.transport({ request: directRequest("after-corrupt-marker"), controls }),
  /STAGE_5E1A_LEDGER_CORRUPT/,
);

const traversalRoot = await nextPrivateRoot();
const traversal = await createTransport({
  privateRootDirectory: traversalRoot,
  runId: "../../attempted-path-traversal",
});
assert.equal(path.dirname(traversal.ledgerDirectory), await realpath(traversalRoot));
assert.match(path.basename(traversal.ledgerDirectory), /^run-[a-f0-9]{64}$/);

const symlinkTargetRoot = await nextPrivateRoot();
const symlinkRootPath = path.join(temporaryRoot, "symlinked-private-root");
await symlink(symlinkTargetRoot, symlinkRootPath);
await assert.rejects(
  createTransport({
    privateRootDirectory: symlinkRootPath,
    runId: "symlink-root",
  }),
  /STAGE_5E1A_LEDGER_ROOT_NOT_PRIVATE/,
);

const symlinkRecord = await createTransport({ runId: "symlink-record" });
const outsideRecord = path.join(temporaryRoot, "outside-attempt.json");
await writeFile(outsideRecord, "{}\n", { mode: 0o600 });
await symlink(outsideRecord, path.join(symlinkRecord.ledgerDirectory, "attempt-01.json"));
await assert.rejects(
  symlinkRecord.transport({ request: directRequest("symlink-record-operation"), controls }),
  /STAGE_5E1A_LEDGER_CORRUPT/,
);

const missingReceipt = await createTransport({
  runId: "missing-receipt",
  mockDispatcher: async () => null,
});
await assert.rejects(
  missingReceipt.transport({ request: directRequest("missing-receipt-operation"), controls }),
  /STAGE_5E1A_PROVIDER_RECEIPT_INVALID/,
);

for (const [name, mutate, expected] of [
  ["sdk-retry", (receipt) => ({ ...receipt, attemptCount: 2 }), /STAGE_5E1A_PROVIDER_RECEIPT_INVALID/],
  ["endpoint", (receipt) => ({ ...receipt, endpoint: "https://unexpected.example.test/v1/responses" }), /STAGE_5E1A_PROVIDER_RECEIPT_INVALID/],
  ["incomplete", (receipt) => ({ ...receipt, completionStatus: "incomplete", output: null }), /STAGE_5E1A_PROVIDER_RECEIPT_INVALID/],
  ["network", (receipt) => ({ ...receipt, observedNetworkDestinations: ["https://unexpected.example.test"] }), /STAGE_5E1A_PROVIDER_RECEIPT_INVALID/],
]) {
  const test = await createTransport({
    runId: `invalid-${name}`,
    mockDispatcher: async (request) => mutate(validReceipt(request)),
  });
  await assert.rejects(
    test.transport({ request: directRequest(`invalid-${name}-operation`), controls }),
    expected,
  );
}

const oversized = await createTransport({
  runId: "oversized-input",
  tokenCounter: (request) => ({
    model: STAGE_5E1A_PINNED_MODEL,
    requestInputFingerprintSha256: requestInputFingerprintSha256(request),
    inputTokensUpperBound: 20_001,
    assurance: "model_compatible_verified_upper_bound",
    method: "synthetic-oversized-bound",
  }),
});
await assert.rejects(
  oversized.transport({ request: directRequest("oversized-operation"), controls }),
  /STAGE_5E1A_INPUT_TOKEN_LIMIT_EXCEEDED/,
);
assert.equal((await readdir(oversized.ledgerDirectory)).some((item) => item.startsWith("attempt-")), false);

const uncertain = await createTransport({
  runId: "uncertain-token-count",
  tokenCounter: () => ({
    model: STAGE_5E1A_PINNED_MODEL,
    requestInputFingerprintSha256: "0".repeat(64),
    inputTokensUpperBound: 1_000,
    assurance: "model_compatible_verified_upper_bound",
    method: "synthetic-wrong-request",
  }),
});
await assert.rejects(
  uncertain.transport({ request: directRequest("uncertain-operation"), controls }),
  /STAGE_5E1A_TOKEN_ADMISSION_UNCERTAIN/,
);

const invalidDocuments = new Map(documentBytesBySourceId);
invalidDocuments.set(sources[0].sourceId, Buffer.from("substituted-document"));
await assert.rejects(
  createTransport({ runId: "invalid-source-bytes", publicDocumentBytes: invalidDocuments }),
  /STAGE_5E1A_SOURCE_DOCUMENT_HASH_INVALID/,
);
await assert.rejects(
  createTransport({ runId: "live-access", liveProviderAccess: true }),
  /STAGE_5E1A_LIVE_PROVIDER_DISABLED/,
);
await assert.rejects(
  createTransport({
    runId: "invalid-cost",
    envelope: { ...offlineEnvelope, maximumCostUsd: 1.64 },
  }),
  /STAGE_5E1A_COST_RESERVATION_INVALID/,
);

const mutableEnvelope = structuredClone(offlineEnvelope);
const immutableEnvelopeTransport = await createTransport({
  runId: "immutable-envelope",
  envelope: mutableEnvelope,
});
mutableEnvelope.model = "mutated-after-admission";
mutableEnvelope.maximumOutputTokensPerRequest = 1;
mutableEnvelope.pricing.outputUsdPerMillionTokens = 0;
await immutableEnvelopeTransport.transport({
  request: directRequest("immutable-envelope-operation"),
  controls,
});

const capped = await createTransport({ runId: "five-attempt-cap" });
for (let index = 0; index < 5; index += 1) {
  await capped.transport({
    request: directRequest(`capped-operation-${index}`, `section-${index}`),
    controls: { ...controls, requestOrdinal: index + 1 },
  });
}
await assert.rejects(
  capped.transport({
    request: directRequest("capped-operation-6", "section-6"),
    controls: { ...controls, requestOrdinal: 6 },
  }),
  /STAGE_5E1A_ATTEMPT_LIMIT_EXHAUSTED/,
);

const transportSource = readFileSync("lib/creator/creatorScriptGenerationPilotOfflineTransport.ts", "utf8");
assert.doesNotMatch(transportSource, /from ["'](?:openai|@supabase)/);
assert.doesNotMatch(transportSource, /process\.env|OPENAI_API_KEY|responses\.create|fetch\s*\(/);
assert.doesNotMatch(transportSource, /creator-script-build\/route|save-project|store-audio|export-movie/);

await rm(temporaryRoot, { recursive: true, force: true });

console.log("STAGE_5E1A_OFFLINE_TRANSPORT_ENFORCEMENT=PASS");
console.log("STAGE_5E1A_ATTEMPT_LIMIT=5");
console.log("STAGE_5E1A_WORST_CASE_COST_USD=1.65");
console.log("STAGE_5E1A_LIVE_PROVIDER_ACCESS=DENIED");
console.log("STAGE_5E1A_NETWORK_ISOLATION=CONTRACT_ONLY_NOT_OS_ENFORCED");
