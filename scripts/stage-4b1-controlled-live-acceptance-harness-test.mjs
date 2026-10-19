import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createJiti } from "jiti";
import { createCreatorScript } from "../lib/creator/creatorScript.ts";
import { createCreatorScriptLiveAcceptanceBudget, DEFAULT_CREATOR_SCRIPT_LIVE_ACCEPTANCE_AUTHORIZATION } from "../lib/creator/creatorScriptLiveAcceptanceBudget.ts";

const previousNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "test"; // Mock acceptance callbacks are never registrable in production.

const jiti = createJiti(import.meta.url, { interopDefault: true, alias: { "@": new URL("..", import.meta.url).pathname.replace(/\/$/u, ""), "server-only": new URL("../lib/creator/projectState.ts", import.meta.url).pathname } });
const { acquireOriginalSourceDocument } = await jiti.import("../lib/research/originalSourceAcquisition.server.ts");
const { runCreatorScriptControlledLiveAcceptance, registerCreatorScriptAcceptanceMockProviders } = await jiti.import("../lib/creator/creatorScriptLiveAcceptanceRunner.ts");

assert.throws(() => createCreatorScriptLiveAcceptanceBudget(DEFAULT_CREATOR_SCRIPT_LIVE_ACCEPTANCE_AUTHORIZATION), /LIVE_AUTHORIZATION_REQUIRED/);
assert.throws(() => createCreatorScriptLiveAcceptanceBudget({ ...DEFAULT_CREATOR_SCRIPT_LIVE_ACCEPTANCE_AUTHORIZATION, allowLiveProviders: true, approvedMaxCostUsd: 0 }), /LIVE_AUTHORIZATION_REQUIRED/);
for (const property of ["approvedMaxCostUsd", "approvedMaxExaRequests", "approvedMaxOpenAiRequests", "approvedMaxOutputTokensPerRequest"]) {
  for (const invalid of [Number.NaN, Infinity, -Infinity, undefined]) {
    assert.throws(() => createCreatorScriptLiveAcceptanceBudget({ ...DEFAULT_CREATOR_SCRIPT_LIVE_ACCEPTANCE_AUTHORIZATION, [property]: invalid }), /LIVE_LIMIT_INVALID/, `${property}: ${invalid}`);
  }
}
for (const property of ["approvedMaxExaRequests", "approvedMaxOpenAiRequests", "approvedMaxOutputTokensPerRequest"]) {
  assert.throws(() => createCreatorScriptLiveAcceptanceBudget({ ...DEFAULT_CREATOR_SCRIPT_LIVE_ACCEPTANCE_AUTHORIZATION, [property]: 0.5 }), /LIVE_LIMIT_INVALID/);
}
assert.throws(() => createCreatorScriptLiveAcceptanceBudget({ ...DEFAULT_CREATOR_SCRIPT_LIVE_ACCEPTANCE_AUTHORIZATION, executionKind: "other" }), /LIVE_LIMIT_INVALID/);
assert.throws(() => createCreatorScriptLiveAcceptanceBudget({ ...DEFAULT_CREATOR_SCRIPT_LIVE_ACCEPTANCE_AUTHORIZATION, executionKind: "mock", allowLiveProviders: true }), /LIVE_AUTHORIZATION_REQUIRED/);
const validatedLiveBudget = createCreatorScriptLiveAcceptanceBudget({ executionKind: "live", allowLiveProviders: true, approvedMaxCostUsd: 1, approvedMaxExaRequests: 1, approvedMaxOpenAiRequests: 3, approvedMaxOutputTokensPerRequest: 500 });
assert.throws(() => validatedLiveBudget.reserve("exa", 0, 500), /LIVE_BUDGET_EXHAUSTED/, "Live requests cannot reserve zero cost");
assert.throws(() => validatedLiveBudget.reserve("exa", Number.NaN, 500), /LIVE_BUDGET_EXHAUSTED/);
assert.throws(() => validatedLiveBudget.reserve("exa", Infinity, 500), /LIVE_BUDGET_EXHAUSTED/);
assert.equal(validatedLiveBudget.report().requestCounts.exa, 0);
const boundedBudget = createCreatorScriptLiveAcceptanceBudget({ executionKind: "mock", allowLiveProviders: false, approvedMaxCostUsd: 0.1, approvedMaxExaRequests: 1, approvedMaxOpenAiRequests: 1, approvedMaxOutputTokensPerRequest: 20 });
boundedBudget.reserve("exa", 0.01, 20);
assert.throws(() => boundedBudget.reserve("exa", 0.01, 20), /REQUEST_LIMIT_EXHAUSTED/);
assert.throws(() => boundedBudget.record({ provider: "exa", requestId: "over-token", inputTokens: 1, outputTokens: 21, estimatedCostUsd: 0.01, reportedCostUsd: 0.01 }), /PROVIDER_USAGE_INVALID/);

const passage = "The controlled source reports a bounded association and explicitly does not establish causation.";
const source = { sourceId: "academic:controlled", adapterId: "academic", mediaKind: "paper", externalId: "controlled", title: "Controlled paper", url: "https://research.example.test/paper", publisher: "Research Press", author: "Research Team", publishedAt: "2026-01-01", language: "en", summary: "Discovery only.", thumbnailUrl: null, durationSec: null, metrics: {}, sourceMetadata: { provenanceVerified: true, highlightCount: 1, verifiedPassageAuthority: "exa-source-highlight-v1", verifiedPassage1: passage, verifiedPassage1Digest: createHash("sha256").update(passage).digest("hex"), verifiedPassage1Locator: "exa-highlight:1" } };
const documentText = `Abstract\n${passage}\nLimitations\nThe sample remains narrow.`;
const publicResolve = async () => [{ address: "8.8.8.8", family: 4 }];
const response = (body, options = {}) => ({ status: options.status ?? 200, headers: { "content-type": options.contentType ?? "text/plain; charset=utf-8", location: options.location }, body: Buffer.from(body) });
const rejectsCode = (operation, code) => assert.rejects(operation, (error) => error?.code === code);
const acquired = await acquireOriginalSourceDocument({ source, authority: "original_research", resolve: publicResolve, request: async () => response(documentText), now: () => "2026-10-19T12:00:00.000Z" });
assert.equal(acquired.document.expectedSha256, createHash("sha256").update(documentText).digest("hex"));
assert.equal(acquired.provenance.finalUrl, source.url);
assert.equal(acquired.provenance.transport, "pinned_https");
const alreadyAborted = new AbortController(); alreadyAborted.abort();
let cancelledRequestCount = 0;
await rejectsCode(() => acquireOriginalSourceDocument({ source, authority: "original_research", signal: alreadyAborted.signal,
  resolve: async () => { cancelledRequestCount += 1; return publicResolve(); },
  request: async () => { cancelledRequestCount += 1; return response(documentText); } }), "SOURCE_FETCH_ABORTED");
assert.equal(cancelledRequestCount, 0, "Cancelled acquisition cannot start DNS or HTTP");
const abortDuringRequest = new AbortController();
await rejectsCode(() => acquireOriginalSourceDocument({ source, authority: "original_research", signal: abortDuringRequest.signal,
  resolve: publicResolve, request: async (_url, _address, _timeout, _size, signal) => {
    assert.equal(signal, abortDuringRequest.signal);
    abortDuringRequest.abort();
    return response(documentText);
  } }), "SOURCE_FETCH_ABORTED");
await rejectsCode(() => acquireOriginalSourceDocument({ source: { ...source, url: "http://research.example.test/paper" }, authority: "original_research", resolve: publicResolve, request: async () => response(documentText) }), "SOURCE_URL_UNSAFE");
await rejectsCode(() => acquireOriginalSourceDocument({ source: { ...source, url: "https://127.0.0.1/paper" }, authority: "original_research", resolve: async () => [{ address: "127.0.0.1", family: 4 }], request: async () => response(documentText) }), "SOURCE_SSRF_REJECTED");
await rejectsCode(() => acquireOriginalSourceDocument({ source, authority: "original_research", resolve: async (hostname) => [{ address: hostname === "169.254.169.254" ? hostname : "8.8.8.8", family: 4 }], request: async () => response("", { status: 302, location: "https://169.254.169.254/latest/meta-data" }) }), "SOURCE_SSRF_REJECTED");
await rejectsCode(() => acquireOriginalSourceDocument({ source, authority: "original_research", maxBytes: 8, resolve: publicResolve, request: async () => response(documentText) }), "SOURCE_DOCUMENT_TOO_LARGE");
await rejectsCode(() => acquireOriginalSourceDocument({ source, authority: "original_research", resolve: publicResolve, request: async () => response(documentText, { contentType: "application/pdf" }) }), "SOURCE_CONTENT_TYPE_UNSUPPORTED");

const words = (prefix, count) => Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(" ");
const context = { version: "0.10H-2H", sourceVersion: "0.10H-2E", editorialConstitution: "Preserve evidence.", readiness: { status: "ready", editorialReadinessScore: 100, reviewReasons: [] }, claims: [{ claimId: "claim-old", claimType: "FACT", text: "Existing claim.", supportingEvidenceIds: ["e-old"], counterEvidenceIds: [], contextualEvidenceIds: [] }], evidence: [{ evidenceId: "e-old", sourceId: "source-old", excerpt: "Existing evidence remains unchanged.", contextNote: null, locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } }], sources: [{ sourceId: "source-old", title: "Existing", url: "https://existing.test/record", publisher: "Archive", author: null, publishedAt: null, directness: "primary", reviewStatus: "usable" }] };
const script = createCreatorScript({ title: "Synthetic acceptance", sections: [{ id: "opening", kind: "opening", heading: "Opening", text: words("open", 120), claimIds: ["claim-old"], evidenceReviewRequired: false }, ...[1, 2, 3].map((number) => ({ id: `body-${number}`, kind: "body", heading: `Body ${number}`, text: words(`body${number}-`, 320), claimIds: ["claim-old"], evidenceReviewRequired: false })), { id: "conclusion", kind: "conclusion", heading: "Conclusion", text: words("end", 120), claimIds: [], evidenceReviewRequired: false }], targetDurationSec: 525, strategyFingerprint: "synthetic-stage-4b", grounding: { context }, generatedAt: "2026-10-19T00:00:00.000Z", updatedAt: "2026-10-19T00:00:00.000Z" });
const scenes = Array.from({ length: 36 }, (_, index) => ({ id: `scene-${index + 1}`, narration: `Scene ${index + 1}` }));
const baselineDigest = createHash("sha256").update(JSON.stringify({ script, scenes })).digest("hex");
const evidence = { evidenceId: "e-controlled", sourceId: source.sourceId, excerpt: passage, contextNote: "Bounded finding.", locator: { section: "exa-highlight:1", page: null, timecodeStartSec: null, timecodeEndSec: null } };
const claim = { claimId: "claim-controlled", claimType: "RESEARCH_FINDING", text: "The controlled source reports an association without proving causation.", propositionKind: "original_research_result", origin: { attributedEntity: "Research Team", referencedWork: source.url }, supportingEvidenceIds: [evidence.evidenceId], counterEvidenceIds: [], contextualEvidenceIds: [] };
const verifiedEvidence = [{ sourceId: source.sourceId, excerpt: passage, locator: evidence.locator, passageDigest: createHash("sha256").update(passage).digest("hex"), authority: "exa-source-highlight-v1" }];
const sections = script.sections.map((section) => ({ ...section, text: `${section.text} refined`, claimIds: section.id === "body-1" ? ["claim-old", claim.claimId] : section.claimIds, lineage: { sourceSectionIds: [section.id] } }));
const usage = (requestId) => ({ requestId, inputTokens: 10, outputTokens: 10, estimatedCostUsd: 0.01, reportedCostUsd: 0.01 });
const authorization = { executionKind: "mock", allowLiveProviders: false, approvedMaxCostUsd: 1, approvedMaxExaRequests: 1, approvedMaxOpenAiRequests: 3, approvedMaxOutputTokensPerRequest: 500 };
const acquireFixture = async ({ source: requestedSource, authority }) => ({ document: { sourceId: requestedSource.sourceId, url: requestedSource.url, content: documentText, acquisition: "trusted_fixture", authority, expectedSha256: createHash("sha256").update(documentText).digest("hex") }, provenance: { sourceId: requestedSource.sourceId, requestedUrl: requestedSource.url, finalUrl: requestedSource.url, redirectChain: [], acquiredAt: "2026-10-19T12:00:00.000Z", contentType: "text/plain", byteLength: Buffer.byteLength(documentText), sha256: createHash("sha256").update(documentText).digest("hex"), transport: "pinned_https" } });
const providers = (overrides = {}) => registerCreatorScriptAcceptanceMockProviders({
  research: async () => ({ value: { sources: [source], verifiedEvidence }, usage: usage("exa-1") }),
  rewrite: async () => ({ value: { sections, addedClaims: [claim], addedEvidence: [evidence], goalResults: [] }, usage: usage("openai-rewrite") }),
  verifyClaims: async () => ({ value: [{ claimId: claim.claimId, status: "supported", evidenceIds: [evidence.evidenceId], summary: "Exact source passage supports the bounded claim." }], usage: usage("openai-claims") }),
  assessGoals: async ({ after }) => ({ value: [{ goalId: "goal-1-dummy", status: "satisfied", sectionIds: [after.sections[1].id], summary: "Changed." }], usage: usage("openai-goals") }),
  ...overrides,
});
const instruction = "Improve the script structure with documented evidence.";
const run = (overrides = {}) => runCreatorScriptControlledLiveAcceptance({ syntheticProjectId: "synthetic-acceptance-stage-4b1", script, scenes, instruction, language: "en", authorization, authorities: { [source.sourceId]: "original_research" }, providers: providers(), acquireDocument: acquireFixture, estimatedCostsUsd: { exa: 0.01, openai: 0.01 }, ...overrides });
const defaultBlocked = await run({ authorization: undefined });
assert.equal(defaultBlocked.status, "BLOCKED");
assert.equal(defaultBlocked.diagnostic, "CREATOR_REFINEMENT_LIVE_AUTHORIZATION_REQUIRED");
assert.deepEqual(defaultBlocked.budget.requestCounts, { exa: 0, openai: 0 });
let accidentallyInvoked = false;
const unregisteredCallbacks = { ...providers({ research: async () => { accidentallyInvoked = true; throw new Error("MUST_NOT_CALL_PROVIDER"); } }) };
const untrustedMock = await run({ providers: unregisteredCallbacks });
assert.equal(untrustedMock.status, "BLOCKED");
assert.equal(untrustedMock.diagnostic, "CREATOR_REFINEMENT_MOCK_PROVIDER_UNTRUSTED");
assert.equal(accidentallyInvoked, false);
const requestedLiveWithoutFactory = await run({ authorization: { executionKind: "live", allowLiveProviders: true, approvedMaxCostUsd: 1, approvedMaxExaRequests: 1, approvedMaxOpenAiRequests: 3, approvedMaxOutputTokensPerRequest: 500 } });
assert.equal(requestedLiveWithoutFactory.status, "BLOCKED");
assert.equal(requestedLiveWithoutFactory.diagnostic, "CREATOR_REFINEMENT_LIVE_ADAPTER_NOT_APPROVED");
assert.deepEqual(requestedLiveWithoutFactory.budget.requestCounts, { exa: 0, openai: 0 });

// Derive real goal IDs by letting the provider echo the runner request's goals is not part of
// the acceptance-provider surface, so use the deterministic planner contract.
const { createCreatorScriptRewriteGoalPlan } = await import("../lib/creator/creatorScriptEditorialRewrite.ts");
const goalResults = createCreatorScriptRewriteGoalPlan(instruction).map((goal) => ({ goalId: goal.goalId, status: "satisfied", sectionIds: ["body-1"], summary: `Independent ${goal.kind} assessment passed.` }));
const validProviders = providers({ assessGoals: async () => ({ value: goalResults, usage: usage("openai-goals") }) });
const accepted = await run({ providers: validProviders });
assert.equal(accepted.status, "REVIEW_REQUIRED", JSON.stringify(accepted));
assert.ok(accepted.preview);
assert.equal(accepted.claimAuthority.every((item) => item.status === "accepted"), true);
assert.equal(accepted.zeroWriteProof.unchanged, true);
assert.equal(accepted.zeroWriteProof.beforeSha256, baselineDigest);
assert.equal(accepted.traces.every((trace) => trace.timingKind === "actual_runtime"), true);
assert.deepEqual(accepted.budget.requestCounts, { exa: 1, openai: 3 });
assert.ok(accepted.warnings.includes("NO_APPLY_PATH"));

const fabricated = await run({ providers: providers({ rewrite: async () => ({ value: { sections, addedClaims: [claim], addedEvidence: [{ ...evidence, excerpt: "A fabricated passage that is absent from the independently acquired source document." }], goalResults: [] }, usage: usage("openai-rewrite") }), assessGoals: async () => ({ value: goalResults, usage: usage("openai-goals") }) }) });
assert.equal(fabricated.status, "BLOCKED");
assert.equal(fabricated.preview, null);
assert.equal(fabricated.zeroWriteProof.unchanged, true);

const emptySemantic = await run({ providers: providers({ verifyClaims: async () => ({ value: [{ claimId: claim.claimId, status: "supported", evidenceIds: [], summary: "Unsupported declaration." }], usage: usage("openai-claims") }), assessGoals: async () => ({ value: goalResults, usage: usage("openai-goals") }) }) });
assert.equal(emptySemantic.status, "BLOCKED");
assert.equal(emptySemantic.zeroWriteProof.unchanged, true);

const contradicted = await run({ providers: providers({ verifyClaims: async () => ({ value: [{ claimId: claim.claimId, status: "contradicted", evidenceIds: [evidence.evidenceId], summary: "The source contradicts this claim." }], usage: usage("openai-claims") }) }) });
assert.equal(contradicted.status, "BLOCKED");

const missingProvenance = await run({ authorities: {} });
assert.equal(missingProvenance.status, "BLOCKED");
assert.equal(missingProvenance.diagnostic, "CREATOR_REFINEMENT_SOURCE_AUTHORITY_MISSING");

const redirectMismatch = await run({ acquireDocument: async ({ source: requestedSource, authority }) => ({ ...(await acquireFixture({ source: requestedSource, authority })), document: { ...(await acquireFixture({ source: requestedSource, authority })).document, url: "https://redirected.example.test/paper" } }) });
assert.equal(redirectMismatch.status, "BLOCKED");
assert.equal(redirectMismatch.zeroWriteProof.unchanged, true);

const malformed = await run({ providers: providers({ rewrite: async () => ({ value: { sections: [], addedClaims: [], addedEvidence: [], goalResults: [] }, usage: usage("openai-rewrite") }) }) });
assert.equal(malformed.status, "BLOCKED");

const overBudget = await run({ authorization: { ...authorization, approvedMaxCostUsd: 0.005 } });
assert.equal(overBudget.status, "BLOCKED");
assert.equal(overBudget.budget.requestCounts.exa, 0);

const interrupted = await run({ providers: providers({ research: async () => { throw new Error("PROVIDER_REQUEST_ABORT_INTERRUPTED"); } }) });
assert.equal(interrupted.status, "BLOCKED");
assert.equal(interrupted.traces[0].outcome, "interrupted");
assert.equal(interrupted.zeroWriteProof.unchanged, true);

const slow = await run({ stageTimeoutMs: 5, providers: providers({ research: async ({ signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("PROVIDER_TIMEOUT")), { once: true })) }) });
assert.equal(slow.status, "BLOCKED");
assert.equal(slow.traces[0].outcome, "timed_out");
let delayedProviderResolved = false;
const ignoresAbort = await run({ stageTimeoutMs: 5, providers: providers({
  research: async () => new Promise((resolve) => setTimeout(() => {
    delayedProviderResolved = true;
    resolve({ value: { sources: [source], verifiedEvidence }, usage: usage("late-exa") });
  }, 25)),
}) });
assert.equal(ignoresAbort.status, "BLOCKED");
assert.equal(ignoresAbort.preview, null);
assert.equal(ignoresAbort.traces[0].outcome, "timed_out");
assert.equal(ignoresAbort.zeroWriteProof.unchanged, true);
await new Promise((resolve) => setTimeout(resolve, 35));
assert.equal(delayedProviderResolved, true, "Provider may physically resolve late but must not be accepted");
let delayedAcquisitionResolved = false;
const ignoresSourceAbort = await run({ stageTimeoutMs: 5, providers: validProviders,
  acquireDocument: async ({ source: requestedSource, authority, signal }) => {
    assert.ok(signal);
    await new Promise((resolve) => setTimeout(resolve, 25));
    delayedAcquisitionResolved = true;
    return acquireFixture({ source: requestedSource, authority });
  } });
assert.equal(ignoresSourceAbort.status, "BLOCKED");
assert.equal(ignoresSourceAbort.preview, null);
assert.equal(ignoresSourceAbort.traces[0].outcome, "timed_out");
await new Promise((resolve) => setTimeout(resolve, 35));
assert.equal(delayedAcquisitionResolved, true);
assert.equal(ignoresSourceAbort.zeroWriteProof.unchanged, true);

const longScript = createCreatorScript({ ...script, targetDurationSec: 900, sections: script.sections.map((section, index) => ({ ...section, text: words(`long-${index}-`, index > 0 && index < 4 ? 600 : 180) })) });
assert.equal(longScript.targetDurationSec, 900, "runner preserves project-configurable 15-minute duration; no fixed 600-second authority exists");
assert.deepEqual(script.sections.length, 5);
assert.deepEqual(scenes.length, 36);
assert.equal(createHash("sha256").update(JSON.stringify({ script, scenes })).digest("hex"), baselineDigest);
if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
else process.env.NODE_ENV = previousNodeEnv;
console.log("STAGE_4B1_CONTROLLED_LIVE_ACCEPTANCE_HARNESS=PASS");
