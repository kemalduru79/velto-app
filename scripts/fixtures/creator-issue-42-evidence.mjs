// Synthetic diagnostic reconstruction, never production project/source content.
export function issue42EvidenceFixture() {
  const summaries = Array.from({length:9},(_,i)=>i===1
    ? 'In this synthetic trial, researchers tested 120 mock agents and reported 25 errors after three repeated tasks.'
    : `Synthetic source ${i+1} discusses a distinct policy premise and its documented interpretation.`);
  const sources=summaries.map((summary,i)=>({sourceId:`source-${i+1}`,adapterId:'web',mediaKind:'article',externalId:null,title:`Synthetic policy source ${i+1}`,url:`https://fixture.invalid/source-${i+1}`,publisher:'Fixture publisher',author:null,publishedAt:'2026-01-01',language:'en',summary,thumbnailUrl:null,durationSec:null,metrics:{},sourceMetadata:{}}));
  const claims=Array.from({length:6},(_,i)=>({claimId:`claim-${i+1}`,claimType:i===5?'FORECAST':'FACT',text:i===5?'An explicitly uncertain scenario might develop from these premises.':`Synthetic documented premise ${i+1}.`,propositionKind:i===5?'editorial_inference':'world_state',origin:{attributedEntity:null,referencedWork:null}}));
  const evidence=Array.from({length:8},(_,i)=>({evidenceId:`evidence-${i+1}`,sourceId:`source-${i+1}`,spanId:i===7?'span-1-1':`span-${i+1}-1`,contextNote:null}));
  const links=evidence.map((e,i)=>({claimId:i===7?'claim-1':`claim-${Math.min(i+1,6)}`,evidenceId:e.evidenceId,stance:i===7?'contradicts':'supports'}));
  const assessments=sources.map(s=>({sourceId:s.sourceId,directness:'secondary',provenanceStatus:'verified',reviewStatus:'usable',reviewReasons:[]}));
  return {sources,proposal:{claims,evidence,links},assessments};
}
