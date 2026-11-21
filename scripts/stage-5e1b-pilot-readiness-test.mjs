import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  STAGE_5E1A_PINNED_MODEL,
  STAGE_5E1A_RESPONSES_ENDPOINT,
  stage5e1aRequestFingerprintSha256,
} from "../lib/creator/creatorScriptGenerationPilotOfflineTransport.ts";
import {
  STAGE_5E1B_READINESS_VERSION,
  STAGE_5E1B_TOKEN_COUNT_ENDPOINT,
  verifyStage5e1bPilotReadiness,
} from "../lib/creator/creatorScriptGenerationPilotReadiness.ts";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const stableJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
const normalize = (value) => value.normalize("NFC")
  .replace(/\r\n?/g, "\n")
  .replace(/[\t\n\f\r ]+/g, " ")
  .trim();
const clone = (value) => structuredClone(value);
const scalarIndex = (value, search) => [...value].findIndex((_, start, scalars) =>
  [...search].every((scalar, index) => scalars[start + index] === scalar)
);

const sectionIds = ["opening", "explanation", "empirical", "tension", "conclusion"];
const sources = sectionIds.map((sectionId, index) => ({
  sourceId: `source-${index + 1}`,
  title: `Synthetic source ${index + 1}`,
  url: `https://publisher.example.test/source-${index + 1}`,
  reviewStatus: "usable",
}));
const evidence = sectionIds.map((sectionId, index) => ({
  evidenceId: `evidence-${index + 1}`,
  sourceId: `source-${index + 1}`,
  excerpt: `Verified synthetic observation ${index + 1} for ${sectionId}.`,
  locator: {
    section: `synthetic-${index + 1}`,
    page: null,
    timecodeStartSec: null,
    timecodeEndSec: null,
  },
}));
const claims = sectionIds.map((sectionId, index) => ({
  claimId: `claim-${index + 1}`,
  claimType: index === 3 ? "HYPOTHESIS" : "RESEARCH_FINDING",
  text: `Synthetic claim ${index + 1}`,
  supportingEvidenceIds: [`evidence-${index + 1}`],
  counterEvidenceIds: [],
  contextualEvidenceIds: [],
}));
const sectionPlan = sectionIds.map((id, index) => ({
  id,
  kind: index === 0 ? "opening" : index === 4 ? "conclusion" : "body",
  heading: `Synthetic ${id}`,
  minimumWords: 100,
  targetWords: 120,
  maximumWords: 140,
}));
const sectionEvidenceAuthorities = sectionIds.map((sectionId, index) => ({
  sectionId,
  claimIds: [`claim-${index + 1}`],
  evidenceIds: [`evidence-${index + 1}`],
  selection: {
    units: [{
      claimId: `claim-${index + 1}`,
      supportingEvidence: [{
        evidenceId: `evidence-${index + 1}`,
        sourceId: `source-${index + 1}`,
        excerpt: evidence[index].excerpt,
      }],
      counterEvidence: [],
      contextualEvidence: [],
    }],
    omittedClaimIds: [],
    omittedEvidenceIds: [],
  },
}));
const sectionClaimRouting = sectionIds.map((sectionId, index) => ({
  sectionId,
  claimIds: [`claim-${index + 1}`],
  evidenceIds: [`evidence-${index + 1}`],
}));

const documentBytes = new Map(sectionIds.map((sectionId, index) => {
  const excerpt = evidence[index].excerpt;
  return [`source-${index + 1}`, Buffer.from(
    `Synthetic publisher document ${index + 1}. ${excerpt} End of bounded document.`,
    "utf8",
  )];
}));
const sourceVerifications = sources.map((source) => ({
  sourceId: source.sourceId,
  canonicalUrl: source.url,
  documentSha256: sha256(documentBytes.get(source.sourceId)),
  verificationMethod: "owner_verified_public_document",
}));
const evidenceVerifications = evidence.map((item) => ({
  evidenceId: item.evidenceId,
  sourceId: item.sourceId,
  passageSha256: sha256(item.excerpt),
  locatorFingerprintSha256: sha256(JSON.stringify(item.locator)),
}));
const fixture = {
  version: "stage-5e0-public-evidence-fixture-v1",
  fixtureId: "synthetic-stage-5e1b-readiness",
  generationInput: {
    narrativePolicy: "science_documentary_v1",
    format: "youtube_video",
    requestedDurationSeconds: 480,
    sectionNative: true,
    sectionPlan,
    sectionEvidenceAuthorities,
    sectionClaimRouting,
    editorialContext: { sources, evidence, claims },
  },
  sourceVerifications,
  evidenceVerifications,
};

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    heading: { type: ["string", "null"] },
    text: { type: "string" },
    claimIds: { type: "array", items: { type: "string" } },
  },
  required: ["heading", "text", "claimIds"],
};
const requests = sectionIds.map((sectionId, index) => {
  const authority = sectionEvidenceAuthorities[index];
  const user = {
    generationAuthority: {
      narrativePolicy: "science_documentary_v1",
      permittedClaimIds: authority.claimIds,
    },
    activeSection: sectionPlan[index],
    activeSectionClaimAuthority: {
      sectionId,
      claimIds: authority.claimIds,
      evidenceIds: authority.evidenceIds,
    },
    activeSectionEvidenceSelection: authority.selection,
    completedSections: sectionIds.slice(0, index).map((id) => ({
      id,
      text: `Synthetic completed section ${id}.`,
      claimIds: [],
    })),
  };
  const request = {
    endpoint: STAGE_5E1A_RESPONSES_ENDPOINT,
    body: {
      model: STAGE_5E1A_PINNED_MODEL,
      service_tier: "default",
      input: [
        { role: "system", content: "Write one bounded synthetic documentary section." },
        { role: "user", content: JSON.stringify(user) },
      ],
      text: {
        format: {
          type: "json_schema",
          name: `synthetic_${sectionId}`,
          strict: true,
          schema,
        },
      },
      max_output_tokens: 25_000,
      reasoning: { effort: "medium" },
      tools: [],
      store: false,
      background: false,
    },
    requestOptions: { maxRetries: 0 },
  };
  return {
    ordinal: index + 1,
    sectionId,
    request,
    tokenAssurance: {
      sectionId,
      classification: "synthetic_test_bound",
      requestFingerprintSha256: stage5e1aRequestFingerprintSha256(request),
      inputTokens: 1_500 + index * 100,
      evidenceOrigin: "caller_supplied_offline",
      accountedComponents: {
        model: true,
        inputMessages: true,
        structuredOutputSchema: true,
        dynamicCompletedSections: true,
      },
      method: "synthetic-byte-envelope-not-model-tokenizer",
    },
  };
});

const documents = sources.map((source) => ({
  sourceId: source.sourceId,
  canonicalUrl: source.url,
  mediaType: "text/plain",
  bytes: documentBytes.get(source.sourceId),
  documentSha256: sha256(documentBytes.get(source.sourceId)),
  extraction: "normalized_plain_text_v1",
  provenance: "synthetic_test_document",
}));
const passages = evidence.map((item) => {
  const normalizedDocument = normalize(new TextDecoder().decode(documentBytes.get(item.sourceId)));
  const normalizedPassage = normalize(item.excerpt);
  const locator = {
    kind: "normalized_unicode_scalar_range",
    start: scalarIndex(normalizedDocument, normalizedPassage),
    end: scalarIndex(normalizedDocument, normalizedPassage) + [...normalizedPassage].length,
  };
  const verification = evidenceVerifications.find((candidate) =>
    candidate.evidenceId === item.evidenceId
  );
  return {
    evidenceId: item.evidenceId,
    sourceId: item.sourceId,
    passageSha256: sha256(item.excerpt),
    normalizedPassageSha256: sha256(normalizedPassage),
    canonicalLocatorFingerprintSha256: verification.locatorFingerprintSha256,
    locator,
    locatorFingerprintSha256: sha256(stableJson(locator)),
    provenance: "synthetic_deterministic_extraction",
  };
});
const manifest = {
  version: STAGE_5E1B_READINESS_VERSION,
  pilotId: "synthetic-stage-5e1b-pilot",
  contract: {
    model: STAGE_5E1A_PINNED_MODEL,
    endpoint: STAGE_5E1A_RESPONSES_ENDPOINT,
    serviceTier: "default",
    maximumCalls: 5,
    targetDurationSeconds: 480,
    maximumInputTokensPerRequest: 20_000,
    maximumOutputTokensPerRequest: 25_000,
    modeledCostReservationUsd: 1.65,
    structuredOutputSchemaSha256: sha256(stableJson(schema)),
  },
  fixture,
  requests,
  documents,
  passages,
  isolation: {
    network: "mock_observation_only",
    credentials: "not_loaded",
    billingReceipts: "unavailable",
    durableAttemptAuthorization: "single_host_fsync",
    liveTransport: "unavailable",
    databaseWrites: "none",
  },
};

const readiness = verifyStage5e1bPilotReadiness(manifest);
assert.equal(readiness.status, "BLOCKED");
assert.equal(readiness.liveDisposition, "NO_GO");
assert.equal(readiness.coverage.requestCount, 5);
assert.equal(readiness.coverage.sectionCount, 5);
assert.equal(readiness.coverage.sourceCount, 5);
assert.equal(readiness.coverage.passageCount, 5);
assert.equal(readiness.persistence, "none");
assert.match(readiness.manifestFingerprintSha256, /^[a-f0-9]{64}$/);
assert.deepEqual(readiness.tokenCalibrationPlan, {
  status: "UNVERIFIED",
  endpoint: STAGE_5E1B_TOKEN_COUNT_ENDPOINT,
  requiresSeparateAuthorization: true,
  countsAsAdditionalProviderRequest: true,
  exactSerializedRequestRequired: true,
  dynamicPerSectionAdmissionRequired: true,
  discrepancyPolicy: "block_and_recalibrate",
  nonTextInputAllowed: false,
});
for (const expected of [
  "TOKEN_ASSURANCE_SYNTHETIC_ONLY",
  "SOURCE_PROVENANCE_SYNTHETIC_ONLY",
  "OS_EGRESS_ISOLATION_MISSING",
  "BILLING_RECEIPT_AUTHORITY_MISSING",
  "ATTEMPT_LEDGER_SINGLE_HOST_ONLY",
  "LIVE_TRANSPORT_UNAVAILABLE",
]) assert.ok(readiness.reasonCodes.includes(expected), expected);
for (const passId of [
  "manifest_integrity",
  "pilot_contract",
  "request_and_section_identity",
  "section_evidence_isolation",
  "source_document_integrity",
  "passage_locator_integrity",
  "credential_isolation",
]) {
  assert.equal(readiness.checks.find((item) => item.id === passId)?.status, "PASS", passId);
}

const assertBlocked = (candidate, code) => {
  const result = verifyStage5e1bPilotReadiness(candidate);
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.reasonCodes.includes(code), `${code}: ${result.reasonCodes.join(",")}`);
};

const falseProviderExact = clone(manifest);
falseProviderExact.requests[0].tokenAssurance.classification = "provider_exact_count";
falseProviderExact.requests[0].tokenAssurance.method = "caller-claims-provider-exact";
falseProviderExact.requests[0].tokenAssurance.independentReceipt = {
  claimedAuthority: "openai",
  requestFingerprintSha256:
    falseProviderExact.requests[0].tokenAssurance.requestFingerprintSha256,
  selfDeclaredVerified: true,
};
assertBlocked(falseProviderExact, "PROVIDER_EXACT_COUNT_RECEIPT_NOT_INDEPENDENTLY_VERIFIED");

const falseCalibrated = clone(manifest);
falseCalibrated.requests[0].tokenAssurance.classification =
  "model_compatible_calibrated_upper_bound";
assertBlocked(falseCalibrated, "TOKEN_CALIBRATION_NOT_INDEPENDENTLY_VERIFIED");

const fingerprintMismatch = clone(manifest);
fingerprintMismatch.requests[0].tokenAssurance.requestFingerprintSha256 = "0".repeat(64);
assertBlocked(fingerprintMismatch, "TOKEN_REQUEST_FINGERPRINT_MISMATCH");

const alteredModel = clone(manifest);
alteredModel.requests[0].request.body.model = "other-model";
alteredModel.requests[0].tokenAssurance.requestFingerprintSha256 =
  stage5e1aRequestFingerprintSha256(alteredModel.requests[0].request);
assertBlocked(alteredModel, "REQUEST_CONTRACT_INVALID");

const alteredSchema = clone(manifest);
alteredSchema.requests[0].request.body.text.format.schema.properties.extra = { type: "string" };
alteredSchema.requests[0].tokenAssurance.requestFingerprintSha256 =
  stage5e1aRequestFingerprintSha256(alteredSchema.requests[0].request);
assertBlocked(alteredSchema, "REQUEST_CONTRACT_INVALID");

const alteredMessage = clone(manifest);
alteredMessage.requests[0].request.body.input[0].content += " Changed.";
assertBlocked(alteredMessage, "TOKEN_REQUEST_FINGERPRINT_MISMATCH");

const dynamicContextChanged = clone(manifest);
const changedUser = JSON.parse(dynamicContextChanged.requests[4].request.body.input[1].content);
changedUser.completedSections[0].text += " Changed after counting.";
dynamicContextChanged.requests[4].request.body.input[1].content = JSON.stringify(changedUser);
assertBlocked(dynamicContextChanged, "TOKEN_REQUEST_FINGERPRINT_MISMATCH");

const schemaUndercounted = clone(manifest);
schemaUndercounted.requests[0].tokenAssurance.accountedComponents.structuredOutputSchema = false;
assertBlocked(schemaUndercounted, "TOKEN_ASSURANCE_INCOMPLETE");

const crossSectionEvidence = clone(manifest);
const crossUser = JSON.parse(crossSectionEvidence.requests[0].request.body.input[1].content);
crossUser.activeSectionClaimAuthority.evidenceIds = ["evidence-2"];
crossSectionEvidence.requests[0].request.body.input[1].content = JSON.stringify(crossUser);
crossSectionEvidence.requests[0].tokenAssurance.requestFingerprintSha256 =
  stage5e1aRequestFingerprintSha256(crossSectionEvidence.requests[0].request);
assertBlocked(crossSectionEvidence, "SECTION_EVIDENCE_BOUNDARY_INVALID");

const invalidProvenance = clone(manifest);
invalidProvenance.documents[0].provenance = "self_attested";
assertBlocked(invalidProvenance, "SOURCE_PROVENANCE_SELF_ATTESTED");

const incorrectLocator = clone(manifest);
incorrectLocator.passages[0].locator.start += 1;
incorrectLocator.passages[0].locator.end += 1;
incorrectLocator.passages[0].locatorFingerprintSha256 =
  sha256(stableJson(incorrectLocator.passages[0].locator));
assertBlocked(incorrectLocator, "EVIDENCE_LOCATOR_INVALID");

const nonIntegerLocator = clone(manifest);
nonIntegerLocator.passages[0].locator.start = 1.5;
nonIntegerLocator.passages[0].locatorFingerprintSha256 =
  sha256(stableJson(nonIntegerLocator.passages[0].locator));
assertBlocked(nonIntegerLocator, "EVIDENCE_LOCATOR_INVALID");

const emptyLocator = clone(manifest);
emptyLocator.passages[0].locator.end = emptyLocator.passages[0].locator.start;
emptyLocator.passages[0].locatorFingerprintSha256 =
  sha256(stableJson(emptyLocator.passages[0].locator));
assertBlocked(emptyLocator, "EVIDENCE_LOCATOR_INVALID");

const repeatedPassage = clone(manifest);
const repeatedBytes = Buffer.from(
  `${new TextDecoder().decode(repeatedPassage.documents[0].bytes)} ${evidence[0].excerpt}`,
  "utf8",
);
repeatedPassage.documents[0].bytes = repeatedBytes;
repeatedPassage.documents[0].documentSha256 = sha256(repeatedBytes);
repeatedPassage.fixture.sourceVerifications[0].documentSha256 = sha256(repeatedBytes);
assertBlocked(repeatedPassage, "EVIDENCE_PASSAGE_AMBIGUOUS_OR_MISSING");

const invalidEncoding = clone(manifest);
const invalidUtf8 = Uint8Array.from([0xc3, 0x28]);
invalidEncoding.documents[0].bytes = invalidUtf8;
invalidEncoding.documents[0].documentSha256 = sha256(invalidUtf8);
invalidEncoding.fixture.sourceVerifications[0].documentSha256 = sha256(invalidUtf8);
assertBlocked(invalidEncoding, "SOURCE_TEXT_DECODING_INVALID");

const forgedPublisherProvenance = clone(manifest);
forgedPublisherProvenance.documents[0].provenance =
  "independently_verified_publisher_document";
assertBlocked(forgedPublisherProvenance, "SOURCE_PROVENANCE_RECEIPT_UNVERIFIED");

const unicodeNormalized = clone(manifest);
const composedPassage = "Verified synthetic observation with Café evidence.";
const decomposedPassage = "Verified synthetic observation with Cafe\u0301 evidence.";
const unicodeBytes = Buffer.from(`Prefix. ${decomposedPassage} Suffix.`, "utf8");
unicodeNormalized.fixture.generationInput.editorialContext.evidence[0].excerpt = composedPassage;
unicodeNormalized.fixture.generationInput.sectionEvidenceAuthorities[0]
  .selection.units[0].supportingEvidence[0].excerpt = composedPassage;
unicodeNormalized.fixture.evidenceVerifications[0].passageSha256 = sha256(composedPassage);
unicodeNormalized.documents[0].bytes = unicodeBytes;
unicodeNormalized.documents[0].documentSha256 = sha256(unicodeBytes);
unicodeNormalized.fixture.sourceVerifications[0].documentSha256 = sha256(unicodeBytes);
const normalizedUnicodeDocument = normalize(new TextDecoder().decode(unicodeBytes));
const normalizedUnicodePassage = normalize(composedPassage);
const unicodeStart = scalarIndex(normalizedUnicodeDocument, normalizedUnicodePassage);
unicodeNormalized.passages[0].passageSha256 = sha256(composedPassage);
unicodeNormalized.passages[0].normalizedPassageSha256 = sha256(normalizedUnicodePassage);
unicodeNormalized.passages[0].locator = {
  kind: "normalized_unicode_scalar_range",
  start: unicodeStart,
  end: unicodeStart + [...normalizedUnicodePassage].length,
};
unicodeNormalized.passages[0].locatorFingerprintSha256 =
  sha256(stableJson(unicodeNormalized.passages[0].locator));
const unicodeUser = JSON.parse(unicodeNormalized.requests[0].request.body.input[1].content);
unicodeUser.activeSectionEvidenceSelection =
  unicodeNormalized.fixture.generationInput.sectionEvidenceAuthorities[0].selection;
unicodeNormalized.requests[0].request.body.input[1].content = JSON.stringify(unicodeUser);
unicodeNormalized.requests[0].tokenAssurance.requestFingerprintSha256 =
  stage5e1aRequestFingerprintSha256(unicodeNormalized.requests[0].request);
const unicodeReport = verifyStage5e1bPilotReadiness(unicodeNormalized);
assert.equal(unicodeReport.checks.find((item) => item.id === "passage_locator_integrity")?.status, "PASS");
assert.equal(unicodeReport.liveDisposition, "NO_GO");

for (const mediaType of ["text/html", "application/pdf"]) {
  const unsupportedExtraction = clone(manifest);
  unsupportedExtraction.documents[0].mediaType = mediaType;
  unsupportedExtraction.documents[0].extraction = "unsupported";
  assertBlocked(unsupportedExtraction, "SOURCE_EXTRACTION_UNSUPPORTED");
}

const unauthorizedTransport = clone(manifest);
unauthorizedTransport.isolation.liveTransport = "separately_authorized";
assertBlocked(unauthorizedTransport, "LIVE_TRANSPORT_UNAUTHORIZED");

const claimedNetworkIsolation = clone(manifest);
claimedNetworkIsolation.isolation.network = "os_egress_deny_verified";
assertBlocked(claimedNetworkIsolation, "NETWORK_ISOLATION_ATTESTATION_UNVERIFIED");

const claimedBilling = clone(manifest);
claimedBilling.isolation.billingReceipts = "independently_verified";
assertBlocked(claimedBilling, "BILLING_RECEIPT_ATTESTATION_UNVERIFIED");

assertBlocked({ version: STAGE_5E1B_READINESS_VERSION }, "READINESS_MANIFEST_INVALID");
assertBlocked(null, "READINESS_MANIFEST_INVALID");

const readinessSource = readFileSync(
  "lib/creator/creatorScriptGenerationPilotReadiness.ts",
  "utf8",
);
assert.doesNotMatch(readinessSource, /from ["'](?:openai|@supabase)/);
assert.doesNotMatch(
  readinessSource,
  /process\.env|OPENAI_API_KEY|responses\.create|fetch\s*\(|createClient\s*\(/,
);
assert.doesNotMatch(readinessSource, /creator-script-build\/route|save-project|export-movie/);

console.log("STAGE_5E1B_PILOT_READINESS=PASS");
console.log("STAGE_5E1B_LIVE_DISPOSITION=NO_GO");
console.log("STAGE_5E1B_REQUESTS=5");
console.log("STAGE_5E1B_TOKEN_CALIBRATION=UNVERIFIED");
console.log("STAGE_5E1B_EXTERNAL_CALLS=0");
