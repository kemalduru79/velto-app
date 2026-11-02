import assert from "node:assert/strict";
import {ClaimPropositionAuthorityDisagreementError,reconcileClaimPropositionAuthorities as reconcile} from "../lib/research/claimPropositionAuthority.ts";
import {researchClaimRequiresPrimarySource} from "../lib/research/claimEvidenceGraph.ts";
const url="https://cacm.acm.org/opinion/three-ai-futures/";
const source={sourceId:"web:"+url,adapterId:"web",mediaKind:"article",externalId:url,title:"Three AI Futures",url,publisher:"ACM",author:null,publishedAt:null,language:"en",summary:"Three scenarios are discussed.",thumbnailUrl:null,durationSec:null,metrics:{},sourceMetadata:{}};
const initial={claimId:"claim-1",claimType:"THEORY",text:"Three kinds of AI futures dominate speculation.",propositionKind:"attributed_statement",origin:{attributedEntity:"cacm.acm.org",referencedWork:null}};
const adjudication={claims:[{claimId:"claim-1",propositionKind:"document_assertion",origin:{attributedEntity:null,referencedWork:"web:"+url}}]};
const context={sources:[source],evidence:[{evidenceId:"evidence-1",sourceId:source.sourceId,excerpt:"Three scenarios are discussed.",contextNote:null,locator:{section:null,page:null,timecodeStartSec:null,timecodeEndSec:null}}],links:[{claimId:"claim-1",evidenceId:"evidence-1",stance:"supports"}]};
const call=(i=initial,a=adjudication,c=context)=>reconcile({initialClaims:[i],adjudication:a,sourceContext:c});
const sameWorkInitial={
  ...initial,origin:{...initial.origin,referencedWork:"web:"+url}
};
assert.equal(call(sameWorkInitial)[0].propositionKind,"document_assertion",
  "Existing same-document work must remain eligible.");
const copy=JSON.stringify({initial,adjudication,context});
const [accepted]=call();
assert.equal(accepted.propositionKind,"document_assertion");
assert.deepEqual(accepted.origin,adjudication.claims[0].origin);
assert.equal(accepted.claimType,initial.claimType);assert.equal(accepted.text,initial.text);
assert.equal(researchClaimRequiresPrimarySource(accepted),true);
assert.equal(JSON.stringify({initial,adjudication,context}),copy,"Source and proposal cannot be mutated.");
const fails=(name,i=initial,a=adjudication,c=context)=>assert.throws(()=>call(i,a,c),e=>e instanceof ClaimPropositionAuthorityDisagreementError,name);
fails("without linked graph",initial,adjudication,null);
fails("another document",initial,{claims:[{...adjudication.claims[0],origin:{attributedEntity:null,referencedWork:"https://other.example/doc"}}]});
fails("named individual",{...initial,origin:{attributedEntity:"Doctor Smith",referencedWork:null}});
fails("another publisher",{...initial,origin:{attributedEntity:"other.example",referencedWork:null}});
fails("facts not auto-reclassified",{...initial,claimType:"FACT"});
fails("no support",initial,adjudication,{...context,links:[]});
fails("contradicting evidence",initial,adjudication,{...context,links:[{...context.links[0],stance:"contradicts"}]});
fails("wrong source",initial,adjudication,{...context,evidence:[{...context.evidence[0],sourceId:"other"}]});
fails("same URL duplicate",initial,adjudication,{...context,sources:[source,{...source,sourceId:"another"}]});
fails("different work already set",{...initial,origin:{...initial.origin,referencedWork:"other"}});
fails("different URL work already set",{...initial,origin:{...initial.origin,referencedWork:"https://another.example/article"}});

fails("primary downgrade",initial,{claims:[{claimId:"claim-1",propositionKind:"world_state",origin:{attributedEntity:null,referencedWork:null}}]});
console.log("CreatorLab safe same-source origin reconciliation PASS");
