import {issue42EvidenceFixture} from './creator-issue-42-evidence.mjs';
export function issue44EvidenceFixture() {
  const {sources}=issue42EvidenceFixture();
  sources[4].summary='The synthetic model applies only to the tested tasks; it does not establish future general performance.';
  sources[5].summary='The synthetic trial used a small sample; the result should not be generalized outside the tested tasks.';
  const claim=(id,claimType,text,propositionKind='world_state',referencedWork=null)=>({claimId:`claim-${id}`,claimType,text,propositionKind,origin:{attributedEntity:null,referencedWork}});
  const claims=[
    claim(1,'FACT','The synthetic trial measured performance on tested tasks.'),
    claim(2,'THEORY','The synthetic theory proposes general success on every task.','expert_synthesis'),
    claim(3,'FORECAST','A real prediction asserts that AI will inevitably control all institutions by 2055.','editorial_inference'),
    claim(4,'PRIMARY_SOURCE_CLAIM','The exact synthetic document states its own policy premise.','document_assertion',sources[8].url),
  ];
  const evidence=Array.from({length:7},(_,i)=>({evidenceId:`evidence-${i+1}`,sourceId:i===6?'source-9':`source-${i+1}`,excerpt:i===6?sources[8].summary:sources[i].summary,contextNote:null,locator:{section:null,page:null,timecodeStartSec:null,timecodeEndSec:null}}));
  const links=[
    [1,1,'supports'],[1,2,'supports'],[2,3,'supports'],[3,4,'supports'],[2,5,'contextualizes'],[3,6,'contextualizes'],[4,7,'supports'],
  ].map(([claim,evidence,stance])=>({claimId:`claim-${claim}`,evidenceId:`evidence-${evidence}`,stance}));
  const assessments=sources.map(source=>({sourceId:source.sourceId,directness:'secondary',provenanceStatus:'complete',reviewStatus:'usable',reviewReasons:[]}));
  return{sources,claims,evidence,links,assessments};
}
