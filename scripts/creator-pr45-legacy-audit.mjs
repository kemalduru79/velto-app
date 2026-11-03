/**
 * Strictly offline, owner-scoped legacy compatibility classification.
 * Never connects to a database and never prints source content, owner IDs,
 * project IDs, scripts or URLs.
 *
 * Usage: VELTO_AUDIT_OWNER_ID=<owner-uuid> node --experimental-transform-types scripts/creator-pr45-legacy-audit.mjs < authorized-owner-projects.ndjson
 *
 * Input: authorized owner export of full project rows including user_id and
 * exported_movie_result.creatorProjectState. Owner identity must match every
 * row; mismatch is a hard stop rather than a filter silently hiding scope.
 */
import {readFileSync} from "node:fs";
import {isCreatorScriptHistoricalResearchOnly,normalizeCreatorScript} from "../lib/creator/creatorScript.ts";
const owner=process.env.VELTO_AUDIT_OWNER_ID;
if(typeof owner!=="string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(owner)){
  process.stderr.write("AUDIT_OWNER_SCOPE_REQUIRED\n");process.exit(2);
}
const contents=readFileSync(0,"utf8");
if(Buffer.byteLength(contents,"utf8")>20*1024*1024){
  process.stderr.write("AUDIT_INPUT_LIMIT_EXCEEDED\n");process.exit(2);
}
const rows=contents.split(/\r?\n/).filter(Boolean);
const counts={reviewed:0,current:0,historical_read_only:0,invalid:0,no_script:0,pending_historical:0,pending_invalid:0};
for(const line of rows){
  let data;try{data=JSON.parse(line);}catch{process.stderr.write("AUDIT_RECORD_INVALID\n");process.exit(2);}
  if(!data || data.user_id!==owner || data.flow_type!=="creator_lab"){
    process.stderr.write("AUDIT_OWNER_OR_FLOW_MISMATCH\n");process.exit(2);
  }
  const snapshot=data?.exported_movie_result?.creatorProjectState;
  const script=snapshot?.strategy?.script;
  const proposed=snapshot?.strategy?.pendingRefinement?.proposedScript;
  counts.reviewed++;
  if(proposed){
    if(isCreatorScriptHistoricalResearchOnly(proposed))counts.pending_historical++;
    else try{normalizeCreatorScript(proposed);}catch{counts.pending_invalid++;}
  }
  if(!script){counts.no_script++;continue;}
  if(isCreatorScriptHistoricalResearchOnly(script))counts.historical_read_only++;
  else try{normalizeCreatorScript(script);counts.current++;}catch{counts.invalid++;}
}
process.stdout.write(JSON.stringify({version:"pr45-owner-scoped-readonly-v2",counts})+"\n");
