import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  SCIENTIFIC_REVIEW_VERSION,
  createSyntheticReviewer, createOwnerBrief, runOfflineScientificReview,
  sha256, validateScientificEvidence,
} from "../lib/creator/scientificReview/index.ts";

const temp = await mkdtemp(path.join(os.tmpdir(), "velto-stage5e1f-") );
let checks = 0;
const check = async (name, fn) => {
  try { await fn(); console.log(`PASS ${++checks}: ${name}`); }
  catch(e) { console.error(`FAIL ${name}`, e); process.exitCode = 1; throw e; }
};
const deepCopy = (x) => structuredClone(x);
const policy = (maxCalls, maximumModeledUsd = 20) => ({
  version: "stage-5e1f-mock-cost-v1", maximumCalls: maxCalls, maximumModeledUsd,
  reservedInputTokensPerCall: 20000, reservedOutputTokensPerCall: 25000,
  assumedInputUsdPerMillion: 2.5, assumedOutputUsdPerMillion: 10, safetyMultiplier: 1.1,
});
const make = (n = 2, pdf = false) => {
  const sources = [], materials = [], evidence = [], claims = [];
  for (let i = 1; i <= n; i++) {
    const passage = `Synthetic observation number ${i} at test time.`;
    const content = `Intro ${i}.\n${passage}\nLimitations apply.\n`;
    const bytes = Buffer.from(content);
    const idx = bytes.indexOf(Buffer.from(passage));
    const documentBytes = pdf ? Buffer.from(`%PDF-1.4 synthetic-only ${i}`) : bytes;
    sources.push({
      sourceId: `source-${i}`, title: `Synthetic study ${i}`, sourceVersion: "v1.0",
      mediaType: pdf ? "application/pdf" : "text/plain",
      documentSha256: sha256(documentBytes), extractedTextSha256: sha256(content),
    });
    materials.push({sourceId:`source-${i}`, documentBytes, extractedText:content});
    evidence.push({
      evidenceId:`evidence-${i}`, sourceId:`source-${i}`, passage,
      passageSha256:sha256(passage), extractedStartByte:idx,
      extractedEndByte:idx+Buffer.byteLength(passage), displayLocator:`line 2, synthetic ${i}`,
    });
    claims.push({
      claimId:`claim-${i}`, claimText:`Synthetic claim ${i}`,
      primaryRole:["statistics","benchmark","modeling","editorial"][(i-1)%4],
      evidenceIds:[`evidence-${i}`], scientificLimitations:["Synthetic corpus"],
    });
  }
  return {input:{version:SCIENTIFIC_REVIEW_VERSION,runId:"mock-run-001",claims,sources,evidence}, materials};
};
const run = (fixture, opts = {}) => runOfflineScientificReview({
  ...fixture,
  reviewer:opts.reviewer || createSyntheticReviewer(),
  costPolicy:opts.costPolicy || policy(fixture.input.claims.length*2),
  runDirectory:path.join(temp, randomUUID()),
  ...opts,
});
const fails = async (pattern, fn) => assert.rejects(fn, pattern);

try {
  await check("2 claims get 4 simulated opinions, no human or live authority", async () => {
    const r = await run(make());
    assert.equal(r.claimCount, 2); assert.equal(r.reviewCount,4);
    assert.equal(r.counts.PRELIMINARY_PASS,2); assert.equal(r.liveAuthorization,false);
    assert.equal(r.independentHumanApproval,false); assert.equal(r.actualProviderSpendUsd,0);
    assert.equal(r.mode,"OFFLINE_MOCK_ONLY");
    assert.match(createOwnerBrief(r), /NOT AN INDEPENDENT SCIENTIFIC REVIEW/);
  });
  await check("23 claim target remains data-driven", async () => {
    const r = await run(make(23), {costPolicy:policy(46)});
    assert.equal(r.claimCount,23); assert.equal(r.reviewCount,46);
    assert.equal(r.counts.PRELIMINARY_PASS,23);
    assert.equal(r.modeledReservedUsd,15.18);
  });
  await check("all 4 specialist roles used", async () => {
    const seen = new Set();
    const delegate=createSyntheticReviewer();
    const reviewer={kind:"offline_mock", async review(task){seen.add(task.role);return delegate.review(task)}};
    await run(make(4), {reviewer});
    assert.deepEqual([...seen].sort(),["benchmark","editorial","modeling","statistics"]);
  });
  await check("cross-review never receives earlier judgment", async () => {
    const seen=[]; const delegate=createSyntheticReviewer();
    const reviewer={kind:"offline_mock",async review(task){seen.push(structuredClone(task)); return delegate.review(task)}};
    await run(make(1), {reviewer});
    assert.equal(seen.length,2); assert.equal(seen[0].assessmentSide,"primary");
    assert.equal(seen[1].assessmentSide,"adversarial");
    assert.equal(JSON.stringify(seen[1]).includes("SYNTHETIC TEST OUTPUT"),false);
    assert.equal(Object.isFrozen(seen[0].evidence), false); // cloned snapshot, original input frozen at invocation
  });
  await check("tampered document rejected before reviewer dispatch", async () => {
    const fx=make(1); fx.materials[0].documentBytes=Buffer.from("not original"); let calls=0;
    await fails(/SOURCE_HASH_MISMATCH/,()=>run(fx,{reviewer:{kind:"offline_mock",async review(){calls++; return {}}}}));
    assert.equal(calls,0);
  });
  await check("tampered passage SHA rejected",async()=>{
    const f=make(1); f.input.evidence[0].passageSha256="0".repeat(64);
    await fails(/PASSAGE_BYTE_OR_HASH_MISMATCH/,()=>run(f));
  });
  await check("tampered exact byte offsets rejected",async()=>{
    const f=make(1);f.input.evidence[0].extractedStartByte++;
    await fails(/PASSAGE_BYTE_OR_HASH_MISMATCH/,()=>run(f));
  });
  await check("duplicated claim IDs rejected",async()=>{
    const f=make(2);f.input.claims[1].claimId=f.input.claims[0].claimId;
    await fails(/DUPLICATE_CLAIMID/,()=>run(f));
  });
  await check("duplicated source IDs rejected",async()=>{
    const f=make(2);f.input.sources[1].sourceId=f.input.sources[0].sourceId;
    await fails(/DUPLICATE_SOURCEID/,()=>run(f));
  });
  await check("duplicated evidence IDs rejected",async()=>{
    const f=make(2);f.input.evidence[1].evidenceId=f.input.evidence[0].evidenceId;
    await fails(/DUPLICATE_EVIDENCEID/,()=>run(f));
  });
  await check("missing evidence reference rejected",async()=>{
    const f=make(1);f.input.claims[0].evidenceIds=["absent"];
    await fails(/CLAIM_METADATA_INVALID/,()=>run(f));
  });
  await check("PDF page mapping unverified therefore no simulated PASS",async()=>{
    const r=await run(make(1,true));assert.equal(r.counts.INSUFFICIENT_EVIDENCE,1);
    assert.deepEqual(r.assessments[0].evidenceLimitations,["UNVERIFIED_PDF_LOCATOR:evidence-1"]);
  });
  await check("adversarial BLOCK dominates",async()=>{
    const r=await run(make(1),{reviewer:createSyntheticReviewer(t=>t.assessmentSide==="adversarial"?"BLOCK":"PRELIMINARY_PASS")});
    assert.equal(r.counts.BLOCK,1);assert.equal(r.assessments[0].disagreement,true);
  });
  await check("REVISE remains an exception",async()=>{
    const r=await run(make(1),{reviewer:createSyntheticReviewer(t=>t.assessmentSide==="adversarial"?"REVISE":"PRELIMINARY_PASS")});
    assert.equal(r.counts.REVISE,1);
  });
  await check("missing evidence cannot PASS",async()=>{
    const delegate=createSyntheticReviewer();
    const reviewer={kind:"offline_mock",async review(t){return {...await delegate.review(t),citedEvidenceIds:[]}}};
    await fails(/PASS_REQUIRES_ALL_REFERENCED_EVIDENCE/,()=>run(make(1),{reviewer}));
  });
  await check("forged human approval field forbidden",async()=>{
    const delegate=createSyntheticReviewer();
    const reviewer={kind:"offline_mock",async review(t){return {...await delegate.review(t),humanApproved:true}}};
    await fails(/JUDGMENT_SCHEMA_INVALID/,()=>run(make(1),{reviewer}));
  });
  await check("malformed judgment forbidden",async()=>{
    await fails(/JUDGMENT_NOT_OBJECT/,()=>run(make(1),{reviewer:{kind:"offline_mock",async review(){return null}}}));
  });
  await check("live provider injection forbidden",async()=>{
    await fails(/LIVE_OR_UNKNOWN_REVIEWER_FORBIDDEN/,()=>run(make(1),{reviewer:{kind:"live",async review(){throw Error("must not call")}}}));
  });
  await check("budget preflight prevents dispatch and private directory creation",async()=>{
    let calls=0;
    const loc=path.join(temp,randomUUID());
    await fails(/PRECHECK_MODELED_BUDGET_INSUFFICIENT/,()=>run(make(2),{
      reviewer:{kind:"offline_mock",async review(){calls++;return {}}},
      costPolicy:policy(1),runDirectory:loc,
    }));
    assert.equal(calls,0);await fails(/ENOENT/,()=>stat(loc));
  });
  await check("USD budget ceiling prevents dispatch",async()=>{
    let calls=0;
    await fails(/PRECHECK_MODELED_BUDGET_INSUFFICIENT/,()=>run(make(1),{
      reviewer:{kind:"offline_mock",async review(){calls++;return {}}},costPolicy:policy(2,.001),
    })); assert.equal(calls,0);
  });
  await check("same run directory cannot be replayed",async()=>{
    const loc=path.join(temp,randomUUID());const f=make(1);
    await run(f,{runDirectory:loc});
    await fails(/RUN_DIRECTORY_ALREADY_EXISTS_OR_UNAVAILABLE/,()=>run(f,{runDirectory:loc}));
  });
  await check("symlink parents and arbitrary symlink ancestors fail closed",async()=>{
    const directTarget=path.join(temp,"direct-target");
    const directAlias=path.join(temp,"direct-alias");
    await mkdir(directTarget);await symlink(directTarget,directAlias,"dir");
    await fails(/PARENT_SYMLINK_FORBIDDEN/,()=>run(make(1),{runDirectory:path.join(directAlias,"run")}));

    const ancestorTarget=path.join(temp,"ancestor-target");
    const ancestorAlias=path.join(temp,"ancestor-alias");
    await mkdir(path.join(ancestorTarget,"nested"),{recursive:true});
    await symlink(ancestorTarget,ancestorAlias,"dir");
    await fails(/PARENT_REALPATH_MISMATCH/,()=>run(make(1),{runDirectory:path.join(ancestorAlias,"nested","run")}));
    await fails(/ENOENT/,()=>stat(path.join(ancestorTarget,"nested","run")));
  });
  await check("failure after dispatch consumes ordinal; cannot resume",async()=>{
    const loc=path.join(temp,randomUUID());let calls=0;
    const reviewer={kind:"offline_mock",async review(){calls++;throw new Error("SIMULATED_CRASH")}};
    await fails(/SIMULATED_CRASH/,()=>run(make(1),{reviewer,runDirectory:loc}));
    assert.equal(calls,1);
    const names=await readdir(loc);
    assert(names.includes("attempt-0001-consumed.json"));
    assert(!names.includes("attempt-0001-result.json"));
    await fails(/RUN_DIRECTORY_ALREADY_EXISTS_OR_UNAVAILABLE/,()=>run(make(1),{runDirectory:loc}));
  });
  await check("durable markers and report use 0600 and directory 0700",async()=>{
    const loc=path.join(temp,randomUUID());await run(make(1),{runDirectory:loc});
    assert.equal((await stat(loc)).mode & 0o777,0o700);
    const names=await readdir(loc);
    assert(names.includes("manifest.json"));assert(names.includes("report.json"));
    assert(names.includes("attempt-0001-consumed.json"));
    assert(names.includes("attempt-0002-result.json"));
    for(const n of names)assert.equal((await stat(path.join(loc,n))).mode & 0o777,0o600);
    const report=JSON.parse(await readFile(path.join(loc,"report.json"),"utf8"));
    assert.equal(report.liveAuthorization,false);
  });
  await check("owner brief deterministic regardless of run output directory",async()=>{
    const f=make(1);const a=await run(f),b=await run(f);
    assert.equal(JSON.stringify(a),JSON.stringify(b));
    assert.equal(createOwnerBrief(a),createOwnerBrief(b));
  });
  await check("top-level human override rejected",async()=>{
    const f=make(1);f.input.humanApproval=true;
    await fails(/INPUT_SCHEMA_INVALID/,()=>run(f));
  });
  console.log(`STAGE_5E1F_OFFLINE_ACCEPTANCE=PASS (${checks} checks)`);
} finally { await rm(temp,{force:true,recursive:true}); }
