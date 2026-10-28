// Stage 5E1G-C2B-B3: independently inspectable, OFFLINE-ONLY broker request policy.
// This is NOT an egress proxy, OS network enforcement, a credential lease, or live authority.
import { createHash } from "node:crypto";

export const CONTROLLED_PILOT_B3_POLICY_VERSION = "stage-5e1g-c2b-b3-offline-broker-v1";
export const CONTROLLED_PILOT_B3_LIVE_FORWARDING_ENABLED = false;

const DESTINATIONS = Object.freeze({
  count: "https://api.openai.com/v1/responses/input_tokens",
  generation: "https://api.openai.com/v1/responses",
});
const HEX_SHA256 = /^[a-f0-9]{64}$/;
const EXECUTION_ID = /^synthetic-[a-z0-9-]{4,80}$/;
const CLIENT_ID = /^velto-[a-z0-9-]{8,180}-(count|generation)-0[1-4]$/;
const STOP_REASONS = Object.freeze([
  "NO_INDEPENDENT_POSITIVE_PATH_EGRESS_BROKER",
  "BROKER_HOST_NETWORK_ENFORCEMENT_UNVERIFIED",
  "NO_CPU_MEMORY_PID_ENFORCEMENT_ATTESTATION",
  "DEDICATED_PROJECT_CREDENTIAL_NOT_PROVISIONED",
  "EPHEMERAL_CREDENTIAL_LEASE_AND_REVOCATION_UNVERIFIED",
  "RETENTION_AND_PROJECT_ACCESS_NOT_APPROVED",
  "TOKEN_COUNT_BILLING_UNRESOLVED",
  "POST_RUN_BILLING_RECONCILIATION_UNVERIFIED",
  "OWNER_LIVE_EXECUTION_AUTHORIZATION_ABSENT",
]);

function deny(reason) {
  throw new Error(`STAGE_5E1G_B3_${reason}`);
}
function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function keysEqual(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length &&
    actual.every((item, index) => item === [...expected].sort()[index]);
}
function ordinalFor(index) {
  return (index % 4) + 1;
}
function stageFor(index) {
  return index < 4 ? "count" : "generation";
}

/**
 * Admits eight locally frozen SYNTHETIC request identities to an offline policy.
 * This factory is not an owner approval mechanism: its output can never grant egress.
 */
export function createB3OfflineBrokerPlan(executionId, requests) {
  if (!EXECUTION_ID.test(executionId) || !Array.isArray(requests) || requests.length !== 8) {
    deny("PLAN_SHAPE_INVALID");
  }
  const identifiers = new Set();
  const approved = requests.map((request, index) => {
    const stage = stageFor(index);
    const ordinal = ordinalFor(index);
    if (!request || typeof request !== "object" || Array.isArray(request) ||
        request.stage !== stage || request.ordinal !== ordinal ||
        !HEX_SHA256.test(request.bodySha256) ||
        !CLIENT_ID.test(request.clientRequestId) ||
        !request.clientRequestId.endsWith(`-${stage}-0${ordinal}`) ||
        identifiers.has(request.clientRequestId)) {
      deny("PLAN_REQUEST_INVALID");
    }
    identifiers.add(request.clientRequestId);
    return Object.freeze({
      stage,
      ordinal,
      clientRequestId: request.clientRequestId,
      bodySha256: request.bodySha256,
      destination: DESTINATIONS[stage],
    });
  });
  return Object.freeze({
    version: CONTROLLED_PILOT_B3_POLICY_VERSION,
    authority: "SYNTHETIC_OFFLINE_POLICY_ONLY",
    executionId,
    approved: Object.freeze(approved),
    liveForwardingEnabled: false,
  });
}

/**
 * Pure preflight to be reused by an independently isolated future broker.
 * Never forward from this module. Validity != external enforcement or owner approval.
 */
export function validateB3OfflineBrokerRequest(plan, request, stage, ordinal) {
  if (plan?.version !== CONTROLLED_PILOT_B3_POLICY_VERSION ||
      plan.authority !== "SYNTHETIC_OFFLINE_POLICY_ONLY" ||
      plan.liveForwardingEnabled !== false ||
      !Array.isArray(plan.approved) || plan.approved.length !== 8) {
    deny("UNTRUSTED_PLAN");
  }
  if (!Object.hasOwn(DESTINATIONS, stage) || !Number.isInteger(ordinal) || ordinal < 1 || ordinal > 4 ||
      !request || typeof request !== "object") {
    deny("REQUEST_SHAPE_INVALID");
  }
  const approved = plan.approved[(stage === "count" ? 0 : 4) + ordinal - 1];
  if (!approved || approved.stage !== stage || approved.ordinal !== ordinal ||
      approved.destination !== DESTINATIONS[stage]) {
    deny("REQUEST_NOT_ALLOWLISTED");
  }
  if (typeof request.url !== "string" || request.url !== DESTINATIONS[stage] ||
      request.method !== "POST" || request.redirects !== "DENY" ||
      request.proxyInheritance !== "DENY" || request.timeoutMs !== 120_000 ||
      !Number.isInteger(request.maximumResponseBytes) || request.maximumResponseBytes < 1 ||
      request.maximumResponseBytes > 1_000_000) {
    deny("DESTINATION_OR_TRANSPORT_POLICY_INVALID");
  }
  const headerNames = request.headers && typeof request.headers === "object" &&
    !Array.isArray(request.headers) ? Object.keys(request.headers).sort() : null;
  if (!keysEqual(headerNames, ["content-type", "x-client-request-id"]) ||
      request.headers["content-type"] !== "application/json" ||
      request.headers["x-client-request-id"] !== approved.clientRequestId ||
      typeof request.body !== "string" || Buffer.byteLength(request.body, "utf8") > 250_000 ||
      !HEX_SHA256.test(request.bodySha256) || sha256(request.body) !== request.bodySha256 ||
      request.bodySha256 !== approved.bodySha256) {
    deny("REQUEST_IDENTITY_INVALID");
  }
  let payload;
  try { payload = JSON.parse(request.body); } catch { deny("BODY_NOT_JSON"); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
      payload.model !== "gpt-5.5-2026-04-23" ||
      (stage === "generation" && (payload.store !== false || payload.background !== false ||
        !Array.isArray(payload.tools) || payload.tools.length !== 0 || payload.tool_choice !== "none"))) {
    deny("PAYLOAD_POLICY_INVALID");
  }
  return Object.freeze({
    stage, ordinal,
    clientRequestId: approved.clientRequestId,
    requestBodySha256: approved.bodySha256,
    disposition: "OFFLINE_POLICY_MATCH_ONLY_NO_EGRESS_AUTHORITY",
  });
}

export function evaluateB3Readiness(_untrustedEvidence = null) {
  // Caller-asserted receipts and flags MUST NOT transform offline status into live GO.
  return Object.freeze({
    version: CONTROLLED_PILOT_B3_POLICY_VERSION,
    disposition: "LIVE_NO_GO",
    independentlyEnforcedHostAndPathEgress: false,
    credentialProvisioned: false,
    credentialRevocationVerified: false,
    ownerExecutionAuthorized: false,
    realNetworkCalls: 0,
    blockers: STOP_REASONS,
  });
}

export function forwardB3LiveRequest() {
  // Deliberately contains NO HTTPS client, proxy socket or credential code.
  deny("LIVE_FORWARDING_DISABLED");
}
