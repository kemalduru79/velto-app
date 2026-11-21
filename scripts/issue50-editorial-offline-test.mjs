import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createCreatorScript, mergeCreatorScriptReplacementSections, getCreatorScriptDocumentText } from "../lib/creator/creatorScript.ts";
import { createCreatorScriptProposal, applyCreatorScriptProposal } from "../lib/creator/creatorScriptRevisions.ts";
import { buildScientificContainerInvocation } from "../lib/creator/scientificReview/containerRuntime.ts";
import { reviewCreatorEditorialNarrative } from "../lib/creator/creatorEditorialNarrativeReview.ts";

const data = JSON.parse(readFileSync(new URL("./fixtures/issue50-editorial-offline.json", import.meta.url)));
let checks = 0;
const check = (fn) => { fn(); checks++; };
const rows = [];
for (const f of data.fixtures) {
  const context = {
    version: "0.10H-2H", sourceVersion: "0.10H-2E",
    editorialConstitution: "Synthetic scenario only. Preserve uncertainty. Do not present this fixture as a study.",
    readiness: { status: "ready", editorialReadinessScore: 0, reviewReasons: ["SYNTHETIC_NOT_RESEARCH_ACCEPTANCE"] },
    claims: f.facts.map((text, i) => ({ claimId: "c"+i, claimType: "FACT", text, supportingEvidenceIds: ["e"+i], counterEvidenceIds: [], contextualEvidenceIds: [] })),
    evidence: f.facts.map((excerpt, i) => ({ evidenceId: "e"+i, sourceId: "synthetic", excerpt, contextNote: f.nature, locator: { section: "fixture", page: null, timecodeStartSec: null, timecodeEndSec: null } })),
    sources: [{ sourceId: "synthetic", title: f.nature, url: "https://example.test/"+f.id, publisher: "Synthetic offline fixture", author: null, publishedAt: null, directness: "primary", reviewStatus: "usable" }],
  };
  const before = createCreatorScript({ title: f.topic,
    sections: f.before.map((text, i) => ({ id: "s"+i, kind: i===0 ? "opening" : i===2 ? "conclusion" : "body", text, claimIds: i===0 ? ["c0"] : i===1 ? ["c0","c1"] : [], evidenceReviewRequired: true })),
    targetDurationSec: 480, strategyFingerprint: "synthetic-"+f.id, grounding: { context },
    generatedAt: "2026-11-15T00:00:00.000Z", updatedAt: "2026-11-15T00:00:00.000Z",
  });
  const original = JSON.stringify(before);
  const baselineReview = reviewCreatorEditorialNarrative(before, "en");
  // Controlled engineering-authored reference edits, not an AI/provider-generation simulation.
  const nextScript = mergeCreatorScriptReplacementSections({ script: before, replacements: before.sections.map((s,i) => ({ ...s, text: f.after[i], evidenceReviewRequired: true, humanVerification: undefined })) });
  const proposal = createCreatorScriptProposal({ script: before, nextScript, scope: "whole_script", instruction: "Replace generic exposition with the supplied bounded editorial reference; preserve hypothetical status and missing evidence.", mode: "editorial_rewrite" });
  const after = applyCreatorScriptProposal(before, proposal, "en");
  const updatedReview = reviewCreatorEditorialNarrative(after, "en");
  check(() => assert.equal(JSON.stringify(before), original));
  check(() => assert.deepEqual(after.grounding, before.grounding));
  check(() => assert.deepEqual(after.sections.map(s=>[s.id,s.kind,s.claimIds]), before.sections.map(s=>[s.id,s.kind,s.claimIds])));
  check(() => assert.equal(after.revision, before.revision+1));
  check(() => assert.equal(after.approval, null));
  check(() => assert.equal(proposal.changes.length, 3));
  check(() => assert.throws(() => applyCreatorScriptProposal(after, proposal, "en"), /STALE/));
  check(() => assert.ok(baselineReview.findings.some(x=>x.code==="generic_hook")));
  check(() => assert.ok(baselineReview.findings.some(x=>x.code==="generic_closing")));
  check(() => assert.equal(updatedReview.findings.filter(x=>["generic_hook","generic_closing","stock_transition"].includes(x.code)).length, 0));
  check(() => assert.ok(updatedReview.findings.length < baselineReview.findings.length));
  check(() => assert.ok(updatedReview.evidenceBoundaries.every(x=>x.counterviewStatus==="NO_BOUND_COUNTEREVIDENCE_DO_NOT_INVENT")));
  for (const script of [before, after]) for (const finding of reviewCreatorEditorialNarrative(script,"en").findings)
    check(() => assert.equal(script.sections.find(s=>s.id===finding.sectionId).text.slice(finding.start,finding.end), finding.excerpt));
  check(() => assert.deepEqual(reviewCreatorEditorialNarrative(before,"tr").findings,[]));
  check(() => assert.equal(updatedReview.factualVerification,"NOT_PERFORMED"));
  const count = script => getCreatorScriptDocumentText(script).split(/\s+/u).filter(Boolean).length;
  rows.push({id:f.id,scope:data.sampleScope,origin:"ENGINEERING_AUTHORED_SYNTHETIC_REFERENCE_APPLIED_THROUGH_EXISTING_PROPOSAL_FLOW",before:before.sections,after:after.sections,beforeWords:count(before),afterWords:count(after),beforeFindings:baselineReview.findings,afterFindings:updatedReview.findings,canonicalRevision:[before.revision,after.revision],groundingUnchanged:true,sectionAndClaimIdentityUnchanged:true,persisted:false,sceneOrMediaMutation:false,ownerAcceptance:"PENDING",manualEditsRemaining:"NOT_MEASURED_OWNER_REVIEW_REQUIRED",researchOrProviderQualityAcceptance:false});
}
// Adversarial/regression cases outside the curated samples.
const f = data.fixtures[0];
const minimal = { sections: [{ id:"a",kind:"body",text:"A direct quotation may repeat a necessary definition here. A direct quotation may repeat a necessary definition here.",claimIds:["c"] }],grounding:{context:{claims:[{claimId:"c",supportingEvidenceIds:["e"],counterEvidenceIds:["contra"],contextualEvidenceIds:[]}]}} };
check(()=>assert.equal(reviewCreatorEditorialNarrative(minimal,"en").findings.filter(x=>x.code==="exact_repetition").length,1));
check(()=>assert.equal(reviewCreatorEditorialNarrative(minimal,"en").evidenceBoundaries[0].counterviewStatus,"BOUND_COUNTEREVIDENCE_REQUIRES_SEMANTIC_REVIEW"));
check(()=>assert.equal(reviewCreatorEditorialNarrative(minimal,"en").requiresOwnerReview,true));
check(()=>assert.equal(reviewCreatorEditorialNarrative(minimal,"en").authority,"ADVISORY_ONLY_NOT_FACT_OR_QUALITY_ACCEPTANCE"));
const clean = {...minimal, sections: [{...minimal.sections[0],text:"No evidence establishes that this effect is inevitable."}]};
check(()=>assert.equal(reviewCreatorEditorialNarrative(clean,"en").findings.length,0));
check(()=>assert.equal(reviewCreatorEditorialNarrative(clean,"en").factualVerification,"NOT_PERFORMED"));
// Quality consistency: flag long unbroken exposition but do not auto-claim low quality.
const denseText = Array.from({length:205},(_,i)=>"observation"+i).join(" ")+".";
const dense = {...minimal,sections:[{...minimal.sections[0],id:"dense-body",text:denseText}]};
const denseFinding = reviewCreatorEditorialNarrative(dense,"en").findings.find(x=>x.code==="dense_exposition");
check(()=>assert.ok(denseFinding));
check(()=>assert.equal(denseFinding.sectionId,"dense-body"));
check(()=>assert.equal(denseText.slice(denseFinding.start,denseFinding.end),denseFinding.excerpt));
check(()=>assert.equal(denseFinding.excerpt.length,500));
check(()=>assert.ok(denseFinding.requestedRevision.includes("without inventing")));
check(()=>assert.equal(reviewCreatorEditorialNarrative(dense,"en").authority,"ADVISORY_ONLY_NOT_FACT_OR_QUALITY_ACCEPTANCE"));
const splitDense = {...minimal,sections:[{...minimal.sections[0],text:[denseText.split(" ").slice(0,110).join(" "),denseText.split(" ").slice(110).join(" ")].join("\n")}]};
check(()=>assert.equal(reviewCreatorEditorialNarrative(splitDense,"en").findings.some(x=>x.code==="dense_exposition"),false));
// Evidence-first narration and genuine counterview diagnostics remain source-scoped.
const observation = {...minimal,sections:[{...minimal.sections[0],text:"Researchers suggest these technologies matter deeply to society."}]};
const observationFindings = reviewCreatorEditorialNarrative(observation,"en").findings;
check(()=>assert.equal(observationFindings.filter(x=>x.code==="generic_evidence_lead").length,1));
check(()=>assert.equal(observationFindings.find(x=>x.code==="generic_evidence_lead").start,0));
check(()=>assert.ok(observationFindings.find(x=>x.code==="generic_evidence_lead").requestedRevision.includes("Do not invent detail")));
const observationNoSupport = {...observation,grounding:{context:{claims:[{...minimal.grounding.context.claims[0],supportingEvidenceIds:[]}]}}};
check(()=>assert.equal(reviewCreatorEditorialNarrative(observationNoSupport,"en").findings.some(x=>x.code==="generic_evidence_lead"),false));
const observedSpecific = {...observation,sections:[{...observation.sections[0],text:"Researchers found 26 participants who reported separate experiences."}]};
check(()=>assert.equal(reviewCreatorEditorialNarrative(observedSpecific,"en").findings.some(x=>x.code==="generic_evidence_lead"),false));
const genericBalanceText = "Some people may see comfort here, while others may see risk.";
const noCounterview = {...observation,sections:[{...observation.sections[0],text:genericBalanceText}],grounding:{context:{claims:[{...minimal.grounding.context.claims[0],counterEvidenceIds:[]}]}}};
const balanceFindings = reviewCreatorEditorialNarrative(noCounterview,"en").findings;
check(()=>assert.equal(balanceFindings.filter(x=>x.code==="generic_balance").length,1));
check(()=>assert.equal(genericBalanceText.slice(balanceFindings[0].start,balanceFindings[0].end),balanceFindings[0].excerpt));
const boundCounterview = {...noCounterview,grounding:minimal.grounding};
check(()=>assert.equal(reviewCreatorEditorialNarrative(boundCounterview,"en").findings.some(x=>x.code==="generic_balance"),false));
check(()=>assert.equal(reviewCreatorEditorialNarrative(noCounterview,"tr").findings.length,0));
check(()=>assert.equal(reviewCreatorEditorialNarrative(noCounterview,"en").factualVerification,"NOT_PERFORMED"));
const many = {...minimal,sections:[{...minimal.sections[0],text:Array.from({length:30},()=>"We now turn to a bounded advisory.").join(" ")}]};
const bounded = reviewCreatorEditorialNarrative(many,"en");
check(()=>assert.equal(bounded.findings.length,20));
check(()=>assert.ok(bounded.omittedFindings>0));
const huge = {...minimal,sections:[{...minimal.sections[0],text:("qualification ".repeat(100))+"."}]};
const span = reviewCreatorEditorialNarrative(huge,"en").findings[0];
check(()=>assert.equal(span.excerpt.length,500));
check(()=>assert.equal(huge.sections[0].text.slice(span.start,span.end),span.excerpt));
const blockedManifest = JSON.parse(readFileSync(new URL("../lib/creator/scientificReview/scientificComputeContainerRuntime.v1.json",import.meta.url)));
check(()=>assert.equal(blockedManifest.status,"BLOCKED_UNPROVISIONED"));
check(()=>assert.throws(()=>buildScientificContainerInvocation(blockedManifest),/CONTAINER_RUNTIME_NOT_PROVISIONED/));
const result = {status:"OFFLINE_REGRESSION_PASS_NOT_EDITORIAL_ACCEPTANCE",checks,fixtureCount:rows.length,providerCalls:0,fullDurationAcceptance:"NOT_RUN",rows};
if (process.env.EDITORIAL_EVIDENCE_OUT) writeFileSync(process.env.EDITORIAL_EVIDENCE_OUT,JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify({status:result.status,checks,fixtures:rows.map(x=>({id:x.id,beforeWords:x.beforeWords,afterWords:x.afterWords,beforeAdvisories:x.beforeFindings.length,afterAdvisories:x.afterFindings.length})),providerCalls:0}));
