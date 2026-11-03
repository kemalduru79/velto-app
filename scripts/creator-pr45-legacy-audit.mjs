/**
 * Offline, owner-scoped aggregate-only compatibility audit.
 * Accepts newline-delimited sanitized project records from an explicit,
 * separately authorized read-only owner export. NO DB/network connections.
 * Outputs counts and reason codes only; never writes or prints research text.
 * Usage: node --experimental-transform-types scripts/creator-pr45-legacy-audit.mjs < owner-projects.ndjson
 */
import {readFileSync} from "node:fs";
import {isCreatorScriptHistoricalResearchOnly,isValidHistoricalCreatorScript,normalizeCreatorScript} from "../lib/creator/creatorScript.ts";
const rows=readFileSync(0,"utf8").split(/\r?\n/).filter(Boolean);
const counts={reviewed:0,current:0,historical_read_only:0,invalid:0,no_script:0,pending_historical:0};
for(const row of rows){
 let data;try{data=JSON.parse(row);}catch{counts.invalid++;continue;}
 const snapshot=data?.exported_movie_result?.creatorProjectState;
 const script=snapshot?.strategy?.script;
 counts.reviewed++;
 if(!script){counts.no_script++;continue;}
 if(isCreatorScriptHistoricalResearchOnly(script)){
   counts.historical_read_only++;
   const proposed=snapshot?.strategy?.pendingRefinement?.proposedScript;
   if(proposed && isValidHistoricalCreatorScript(proposed))counts.pending_historical++;
 }else{
   try{normalizeCreatorScript(script);counts.current++;}catch{counts.invalid++;}
 }
}
process.stdout.write(JSON.stringify({version:"pr45-owner-scoped-readonly-v1",counts})+"\n");
