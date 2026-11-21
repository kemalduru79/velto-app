import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createCreatorScript, createCreatorScriptSectionBudgetPlan,
  createCreatorScriptRepairTargets, getCreatorScriptRepairReplacementDiagnostics,
  getCreatorScriptSectionDiagnostics, shouldUseCreatorScriptSectionNativeGeneration,
} from "../lib/creator/creatorScript.ts";

const plan = createCreatorScriptSectionBudgetPlan({targetDurationSec:180, language:"en"});
assert.deepEqual(plan.map(s=>s.id),["opening","section-1","section-2","conclusion"]);
assert.equal(plan.reduce((n,s)=>n+s.targetWords,0),423);
assert.ok(Math.max(...plan.filter(s=>s.kind==="body").map(s=>s.targetWords))<200,
  "a 3-minute narrative cannot safely give one body almost the entire word budget");
assert.notEqual(plan[1].role,plan[2].role,"compact bodies must have distinct editorial roles");
assert.equal(shouldUseCreatorScriptSectionNativeGeneration(423),false,
  "balanced compact planning must not add provider generation calls");

const words=count=>Array.from({length:count},(_,i)=>"word"+i).join(" ");
const counts=[54,113,113,74];
assert.equal(counts.reduce((a,b)=>a+b,0),354,"preserve the observed under-duration total");
const context={
  version:"0.10H-2H",sourceVersion:"0.10H-2E",
  editorialConstitution:"Ground evidence and uncertainty.",
  readiness:{status:"ready",editorialReadinessScore:100,reviewReasons:[],
    primarySourceRequiredClaimIds:[],primarySourceCoveredClaimIds:[]},
  claims:[],evidence:[],sources:[],
};
const script=createCreatorScript({
  title:"Compact duration regression",
  sections:plan.map((p,i)=>({id:p.id,kind:p.kind,
    heading:["Human Stakes","Framing","Mechanism","Open Question"][i],
    text:words(counts[i]),claimIds:[],evidenceReviewRequired:false})),
  targetDurationSec:180,strategyFingerprint:"compact-geometry-test",
  grounding:{context},generatedAt:"2026-11-21T18:30:00Z",updatedAt:"2026-11-21T18:30:00Z",
});
const targets=createCreatorScriptRepairTargets({
  sections:getCreatorScriptSectionDiagnostics(script,plan),direction:"rebalance_sections",
});
assert.deepEqual(targets.map(t=>t.direction),["compress","expand","expand","compress"]);
assert.ok(targets[1].minimumRequiredGain>0);
assert.ok(targets[3].minimumRequiredReduction>0);
const replacements=plan.map((p,i)=>({id:p.id,kind:p.kind,heading:"Repair "+i,
  text:words(p.targetWords),claimIds:[]}));
const pass=getCreatorScriptRepairReplacementDiagnostics({
  script,plan,replacements,targets,
});
assert.ok(pass.every(p=>p.accepted),JSON.stringify(pass));
const wrong=[...replacements];
wrong[0]={...wrong[0],text:words(25)};
wrong[1]={...wrong[1],text:words(100)};
wrong[3]={...wrong[3],text:words(plan[3].maximumWords+1)};
const denied=getCreatorScriptRepairReplacementDiagnostics({
  script,plan,replacements:wrong,targets,
});
assert.deepEqual(denied.map(d=>d.accepted),[false,false,true,false]);
assert.equal(denied[0].reason,"below_minimum");
assert.equal(denied[1].reason,"wrong_direction_expand");
assert.equal(denied[3].reason,"insufficient_minimum_reduction");
const route=fs.readFileSync("app/api/creator-script-plan/route.ts","utf8");
assert.match(route,/requiredDirection: target\.direction/);
assert.match(route,/minimumRequiredReduction: target\.minimumRequiredReduction/);
assert.match(route,/targets: repairTargets/);
console.log("creator-compact-duration-repair-regression-test: PASS");
