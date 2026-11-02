import assert from "node:assert/strict";
import fs from "node:fs";
import {
  prepareCreatorLongFormSectionPlanForAvailableEvidence as prepare,
  createCreatorLongFormEvidenceReadiness as readiness,
} from "../lib/research/creatorLongFormEvidenceReadiness.ts";

const section = (id,kind,owns) => ({
  id,kind,role:id,centralQuestion:"What does the evidence show?",
  progression:"Develop a distinct evidence-grounded argument.",
  ownershipBoundary:{usage:"control_only_never_narrate",owns,excludes:["invented_source"]},
  minimumWords:kind==="body"?285:111,targetWords:kind==="body"?317:124,
  maximumWords:kind==="body"?349:137,
});
const plan=[
 section("opening","opening",["human_stakes"]),
 section("section-1","body",["definition","framing"]),
 section("section-2","body",["mechanism","causal_process"]),
 section("section-3","body",["grounded_synthesis","evidence_interpretation"]),
 section("section-4","body",["limits","uncertainty","scope_conditions"]),
 section("conclusion","conclusion",["highest_order_implication"]),
];
const claims=Array.from({length:4},(_,index)=>({
 claimId:"claim-"+(index+1),claimType:"FACT",text:"Evidence-backed fact "+(index+1),
 supportingEvidenceIds:["e-"+(index+1)],counterEvidenceIds:[],contextualEvidenceIds:[],
}));
const context={
 version:"0.10H-2H",sourceVersion:"0.10H-2E",editorialConstitution:"Never invent uncertainty.",
 readiness:{status:"ready",editorialReadinessScore:85,reviewReasons:[],primarySourceRequiredClaimIds:[],primarySourceCoveredClaimIds:[]},
 claims,evidence:Array.from({length:6},(_,index)=>({
  evidenceId:"e-"+(index+1),sourceId:"s-"+(index+1),excerpt:"Documented statement "+(index+1)+".",contextNote:null,locator:{}
 })),sources:[],
};
const original=JSON.stringify({plan,context});
assert.deepEqual(readiness({context,plan,sectionNative:true}).reasonCodes,["missing_uncertainty_capability"]);
const adjusted=prepare({context,plan,sectionNative:true});
assert.equal(adjusted.originalReadiness.eligible,false);
assert.equal(adjusted.finalReadiness.eligible,true);
assert.deepEqual(adjusted.finalReadiness.reasonCodes,[]);
assert.deepEqual(adjusted.adaptedSectionIds,["section-4"]);
assert.deepEqual(adjusted.plan[4].ownershipBoundary.owns,["grounded_tension","evidence_boundary"]);
assert.ok(adjusted.plan[4].ownershipBoundary.excludes.includes("invented_uncertainty"));
for(let i=0;i<plan.length;i++){
 const before=plan[i],after=adjusted.plan[i];
 for(const property of ["id","kind","minimumWords","targetWords","maximumWords"]){
  assert.equal(after[property],before[property]);
 }
 if(i!==4)assert.equal(after,before);
}
assert.equal(JSON.stringify({plan,context}),original,"No factual authority or canonical state is mutated.");
const nonNative=prepare({context,plan,sectionNative:false});
assert.equal(nonNative.plan,plan);
assert.deepEqual(nonNative.adaptedSectionIds,[]);
const withUncertainty={
 ...context,claims:context.claims.map((claim,index)=>index===3?{...claim,claimType:"THEORY"}:claim),
};
const alreadyReady=prepare({context:withUncertainty,plan,sectionNative:true});
assert.equal(alreadyReady.plan,plan,"Never downgrade supported uncertainty.");
assert.equal(alreadyReady.finalReadiness.eligible,true);

const noGrounding={...context,claims:context.claims.map((claim)=>({...claim,supportingEvidenceIds:[]}))};
const noGroundingResult=prepare({context:noGrounding,plan,sectionNative:true});
assert.equal(noGroundingResult.plan,plan);
assert.equal(noGroundingResult.finalReadiness.eligible,false);

const counterviewPlan=plan.map((part)=>part.id==="section-4"?{
 ...part,ownershipBoundary:{...part.ownershipBoundary,owns:["counterview","thesis_stress_test","limits","uncertainty"]},
}:part);
const counterviewResult=prepare({context,plan:counterviewPlan,sectionNative:true});
assert.equal(counterviewResult.plan,counterviewPlan,"Unresolved counterview may not be removed by adaptation.");
assert.ok(counterviewResult.finalReadiness.reasonCodes.includes("missing_counterview_capability"));

const api=fs.readFileSync(new URL("../app/api/creator-script-plan/route.ts",import.meta.url),"utf8");
assert.match(api,/prepareCreatorLongFormSectionPlanForAvailableEvidence\(/);
assert.match(api,/const sectionBudgetPlan = preparedPlan\.plan;/);
assert.match(api,/const narrationControlPlan = createCreatorScriptNarrationControlPlan\(sectionBudgetPlan\);/);
assert.match(api,/const longFormEvidenceReadiness = preparedPlan\.finalReadiness;/);
assert.match(api,/plan: sectionBudgetPlan,/);
assert.ok(api.includes("sectionBudgetPlan.map((section) => [section])"), "Generated units use the adapted plan.");
console.log("CreatorLab long-form grounding role adaptation: PASS");
