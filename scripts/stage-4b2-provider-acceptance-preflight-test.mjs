import assert from "node:assert/strict";
import { canonicalStage4B2ApprovedUrl, prepareCreatorScriptStage4B2Approval } from "../lib/creator/creatorScriptStage4B2Preflight.ts";

const request = {
  syntheticProjectId: "synthetic-acceptance-stage4b2",
  researchQuery: "original research on simulated social agents",
  instruction: "Revise the opening using verified original research evidence.",
};
const approval = {
  approvalReference: "human-approval-to-be-confirmed-outside-repo",
  approvedAt: "2026-10-19T11:00:00.000Z",
  expiresAt: "2026-10-20T11:00:00.000Z",
  ...request,
  approvedMaxCostUsd: 2,
  approvedMaxExaRequests: 1,
  approvedMaxOpenAiRequests: 3,
  approvedMaxOutputTokensPerRequest: 6000,
  allowedSources: [{ url: "https://research.example.test/paper", authority: "original_research" }],
};
const prepare = (changes = {}, params = {}) => prepareCreatorScriptStage4B2Approval({ approval: { ...approval, ...changes }, request, now: "2026-10-19T12:00:00.000Z", ...params });

const oldFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("NO_NETWORK_EXPECTED"); };
try {
  const absent = prepareCreatorScriptStage4B2Approval({ request, now: "2026-10-19T12:00:00.000Z" });
  assert.equal(absent.status, "REVIEW_REQUIRED");
  assert.equal(absent.approvedMaxCostUsd, 0);
  assert.equal(absent.readyToExecuteLive, false);
  assert.ok(absent.blockers.includes("EXPLICIT_USER_APPROVAL_NOT_PROVIDED"));

  const valid = prepare();
  assert.equal(valid.status, "REVIEW_REQUIRED", "well-formed approval text is not trusted proof of actual consent");
  assert.equal(valid.readyToExecuteLive, false, "no live adapter is enabled");
  assert.deepEqual(valid.approvedSources, approval.allowedSources);
  assert.ok(valid.blockers.includes("APPROVAL_PROVENANCE_NOT_INDEPENDENTLY_VERIFIED"));
  assert.equal(canonicalStage4B2ApprovedUrl("https://research.example.test/paper#abstract"), "https://research.example.test/paper");
  assert.equal(prepare({}, { request: { ...request, discoveredSourceUrls: ["https://research.example.test/paper"] } }).status, "REVIEW_REQUIRED");

  assert.ok(prepare({}, { request: { ...request, discoveredSourceUrls: ["https://unapproved.example.test/paper"] } }).blockers.includes("DISCOVERED_SOURCE_OUTSIDE_APPROVED_SCOPE"));
  assert.ok(prepare({}, { request: { ...request, discoveredSourceUrls: [] } }).blockers.includes("DISCOVERED_SOURCE_OUTSIDE_APPROVED_SCOPE"));
  assert.ok(prepare({}, { request: { ...request, researchQuery: "different" } }).blockers.includes("APPROVAL_SCOPE_MISMATCH"));
  assert.ok(prepare({}, { request: { ...request, instruction: "unapproved instructions" } }).blockers.includes("APPROVAL_SCOPE_MISMATCH"));
  assert.ok(prepare({}, { request: { ...request, syntheticProjectId: "production-project" } }).blockers.includes("SYNTHETIC_PROJECT_REQUIRED"));
  assert.ok(prepare({ expiresAt: "2026-10-19T12:00:00.000Z" }).blockers.includes("APPROVAL_NOT_ACTIVE"));
  assert.ok(prepare({ approvedAt: "2026-10-19T13:00:00.000Z" }).blockers.includes("APPROVAL_NOT_ACTIVE"));
  assert.ok(prepare({ approvedAt: "not-a-date" }).blockers.includes("APPROVAL_DATES_INVALID"));

  for (const value of [NaN, Infinity, -Infinity, 0, -1, undefined]) {
    for (const property of ["approvedMaxCostUsd", "approvedMaxExaRequests", "approvedMaxOpenAiRequests", "approvedMaxOutputTokensPerRequest"]) {
      assert.ok(prepare({ [property]: value }).blockers.includes("APPROVAL_LIMIT_INVALID"), `${property}=${value}`);
    }
  }
  assert.ok(prepare({ approvedMaxExaRequests: 2 }).blockers.includes("STAGE_4B2_TRIAL_CALL_SCOPE_INVALID"));
  assert.ok(prepare({ approvedMaxOpenAiRequests: 4 }).blockers.includes("STAGE_4B2_TRIAL_CALL_SCOPE_INVALID"));

  for (const url of ["http://research.example.test/paper", "https://localhost/a", "https://user:pass@research.example.test/paper", "invalid-url"]) {
    assert.ok(prepare({ allowedSources: [{ url, authority: "original_research" }] }).blockers.includes("APPROVED_SOURCE_SCOPE_INVALID"), url);
  }
  assert.ok(prepare({ allowedSources: [...approval.allowedSources, ...approval.allowedSources] }).blockers.includes("APPROVED_SOURCE_SCOPE_INVALID"));
  assert.ok(prepare({ allowedSources: [{ url: "https://research.example.test/paper", authority: "made-up" }] }).blockers.includes("APPROVED_SOURCE_SCOPE_INVALID"));
  assert.equal(prepare({ allowedSources: [] }).status, "BLOCKED");

  // These checks evaluate only plan metadata, never use live keys/providers or update a project.
  console.log("STAGE_4B2_PROVIDER_ACCEPTANCE_PREFLIGHT=PASS");
} finally {
  globalThis.fetch = oldFetch;
}
