import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const creator = read("app/api/creator-export/route.ts");
const storyverse = read("app/api/export-movie/route.ts");
const ownership = read("lib/creator/finalMovieOwnership.server.ts");
const service = read("export-service/src/server.js");

for (const [route, dispatchNeedle] of [
  [creator, 'fetch(`${exportApiBase}/export-movie`'],
  [storyverse, 'fetch(`${exportApiBase}/export-movie`'],
]) {
  assert.match(route, /checkStorageGenerationAllowance\(principal\.id\)/);
  assert.match(route, /issueStorageAdmissionForOwner\(\{[\s\S]*mediaKind: "video"[\s\S]*purpose: "final_movie_export"[\s\S]*projectReference: project\.id/);
  assert.ok(route.indexOf("checkStorageGenerationAllowance(principal.id)") < route.indexOf("issueStorageAdmissionForOwner({"), "quota must precede admission");
  assert.ok(route.indexOf("issueStorageAdmissionForOwner({") < route.indexOf(dispatchNeedle), "admission must precede export dispatch");
  assert.match(route, /storageQuotaFullResponse\(storageAllowance\.storage\)/);
  for (const field of ["ownerUserId", "userId", "storageAdmissionId", "consumptionToken", "storageBucket", "storagePath"]) {
    assert.match(route, new RegExp(`delete exportPayload\\.${field}`), `${field} must not be forwarded from the browser body`);
  }
}
assert.ok(creator.indexOf("issueStorageAdmissionForOwner({") < creator.indexOf("reserveMeteredOperation(request"), "Creator admission must precede credit reservation");
assert.ok(creator.indexOf("reserveMeteredOperation(request") < creator.indexOf("fetch(`${exportApiBase}/export-movie`"), "Creator credits precede only admitted dispatch");
assert.ok(storyverse.indexOf("getFinalMovieExportApiBase()") < storyverse.indexOf("checkStorageGenerationAllowance(principal.id)"), "Storyverse service configuration must precede admission");
assert.match(creator, /STORAGE_ADMISSION_UNAVAILABLE[\s\S]*creditReserved: false/);
assert.doesNotMatch(storyverse, /reserveMeteredOperation|settleMeteredOperation/);

assert.match(ownership, /ownedFinalMovieHeaders\(ownerUserId: string, projectId: string, token: string, storageAdmissionId: string\)/);
assert.match(ownership, /"x-velto-storage-admission-id": storageAdmissionId/);
assert.doesNotMatch(creator + storyverse, /storageAdmissionId[,\s]*\n?[\s\S]{0,80}NextResponse\.json/);

assert.match(service, /x-velto-storage-admission-id/g);
assert.match(service, /UUID_PATTERN\.test\(storageAdmissionId\)/);
assert.match(service, /\.eq\("id", ownership\.storageAdmissionId\)[\s\S]*\.eq\("owner_user_id", ownership\.ownerUserId\)[\s\S]*\.eq\("media_kind", "video"\)[\s\S]*\.eq\("purpose", "final_movie_export"\)[\s\S]*\.eq\("project_reference", ownership\.projectId\)/);
const handler = service.slice(service.indexOf('app.post("/export-movie"'), service.indexOf("const port ="));
const begin = handler.indexOf("beginFinalMovieStorageAdmission(supabase, ownership)");
const render = handler.indexOf("for (let i = 0; i < usableScenes.length");
const upload = handler.indexOf('.from("movies")');
const durable = handler.indexOf("durableStorageStarted = true");
const complete = handler.indexOf("completeFinalMovieStorageAdmission(supabase, ownership, consumptionToken)");
assert.ok(begin >= 0 && begin < render && render < upload && upload < durable && durable < complete, "BEGIN/render/upload/durable/COMPLETE ordering");
assert.match(handler, /if \(consumptionToken && !durableStorageStarted && supabase && ownership\)[\s\S]*abortFinalMovieStorageAdmission/);
assert.match(handler, /FINAL_MOVIE_STORAGE_ADMISSION_RECOVERY_REQUIRED[\s\S]*admissionId[\s\S]*ownerUserId[\s\S]*projectId[\s\S]*storagePath/);
const recoveryLog = handler.slice(handler.indexOf('console.error("FINAL_MOVIE_STORAGE_ADMISSION_RECOVERY_REQUIRED"'), handler.indexOf("throw new FinalMovieStorageAdmissionError", handler.indexOf('console.error("FINAL_MOVIE_STORAGE_ADMISSION_RECOVERY_REQUIRED"')));
assert.doesNotMatch(recoveryLog, /serviceRole|internalExportToken|consumptionToken/);
assert.doesNotMatch(handler.slice(durable, handler.indexOf("return res.json")), /abortFinalMovieStorageAdmission|checkStorageGenerationAllowance/);
assert.doesNotMatch(handler, /res\.json\([\s\S]{0,300}consumptionToken|consumption_token/);
assert.match(service, /app\.get\("\/health"/);

assert.match(creator + storyverse, /registerOwnedFinalMovieResponse/);
assert.match(read("lib/persistence/media/registerStoredAsset.ts"), /Stored object registration failed; object requires reconciliation/);

console.log("stage-0.7d-3b final export admission: all checks passed");
