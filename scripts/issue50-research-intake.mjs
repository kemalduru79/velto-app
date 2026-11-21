import fs from "node:fs";
import { createHash } from "node:crypto";
import { createCreatorScriptSectionBudgetPlan } from "../lib/creator/creatorScript.ts";
import { createCreatorLongFormEvidenceReadiness, createCreatorScriptSectionClaimRouting } from "../lib/research/creatorLongFormEvidenceReadiness.ts";
import { createCreatorScriptBuildSectionEvidenceAuthorities } from "../lib/creator/creatorScriptBuildSectionEvidence.ts";
export function prepareResearchIntake() {
  const corpus = JSON.parse(fs.readFileSync("scripts/fixtures/issue50-research-corpus-v2.json"));
  const hash = (s) => createHash("sha256").update(s).digest("hex");
  for (const e of corpus.evidence) if (hash(e.summary) !== e.summarySha256) throw Error("RESEARCH_SUMMARY_DRIFT");
  const claims = corpus.evidence.map((e, i) => ({ claimId: `research-claim-${i + 1}`, claimType: e.claimType, text: e.summary, supportingEvidenceIds: [e.evidenceId], counterEvidenceIds: [], contextualEvidenceIds: e.role === "limitation" ? [e.evidenceId] : [] }));
  claims.push({ claimId: "research-conclusion", claimType: "EDITORIAL_INFERENCE", text: "The studies leave a decision about boundaries: a convincing reply can matter emotionally without becoming historical testimony or consent.", supportingEvidenceIds: ["research-e5", "research-e12"], counterEvidenceIds: [], contextualEvidenceIds: [] });
  const context = { version: "0.10H-2H", sourceVersion: "0.10H-2E", editorialConstitution: corpus.rules.join(" "), readiness: { status: "review", editorialReadinessScore: 0, reviewReasons: ["Owner source/strategy acceptance and editorial scoring have not occurred; long-form capability eligibility is only a necessary structural floor"], primarySourceRequiredClaimIds: [], primarySourceCoveredClaimIds: [] }, claims, evidence: corpus.evidence.map((e) => ({ evidenceId: e.evidenceId, sourceId: e.sourceId, excerpt: e.summary, contextNote: `${e.binding}; ${corpus.rules.join(" ")}`, locator: e.locator })), sources: corpus.sources.map((s) => ({ sourceId: s.sourceId, title: s.title, url: s.url, publisher: new URL(s.url).hostname, author: null, publishedAt: null, directness: "primary", reviewStatus: "usable", searchLane: "academic", sourceKind: "paper" })) };
  const sectionPlan = createCreatorScriptSectionBudgetPlan({ targetDurationSec: 480, language: "en", narrativePolicy: "science_documentary_v1" });
  const readiness = createCreatorLongFormEvidenceReadiness({ context, plan: sectionPlan, sectionNative: true });
  const routing = createCreatorScriptSectionClaimRouting({ context, plan: sectionPlan });
  const authorities = createCreatorScriptBuildSectionEvidenceAuthorities({ context, sectionPlan, sectionClaimRouting: routing });
  const generationInput = { version: "0.19E3A-script-generation-request-v1", topic: corpus.topic, researchSubject: corpus.topic, title: "When a Digital Memory Starts Answering Back", contentType: "documentary", narrativePolicy: "science_documentary_v1", format: "youtube_video", language: "en", requestedDurationSeconds: 480, strategyFingerprint: hash(JSON.stringify(corpus)), approvedStrategy: { version: "issue50-public-research-v2", scientificComputation: "DISABLED", ownerAcceptance: "PENDING" }, creatorProfile: { version: "issue50-public-offline-pilot", tone: "Accessible, compassionate, critically precise; no medical advice" }, sectionPlan, sectionNative: true, longFormEvidenceReadiness: readiness, sectionClaimRouting: routing, sectionEvidenceAuthorities: authorities, editorialContext: context, permittedClaimIds: claims.map((c) => c.claimId) };
  return { generationInput, readiness, corpusSha256: hash(JSON.stringify(corpus)), ownerAccepted: false, providerAuthorized: false };
}
if (process.argv[1]?.endsWith("/issue50-research-intake.mjs")) console.log(JSON.stringify(prepareResearchIntake(), null, 2));
