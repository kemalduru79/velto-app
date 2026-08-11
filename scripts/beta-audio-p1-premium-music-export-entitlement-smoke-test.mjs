import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const route = read("app/api/creator-export/route.ts");
const service = read("lib/creator/musicEntitlement.ts");
const exportService = read("export-service/src/server.js");
const policy = read("lib/credits/operationPolicy.ts");
const musicRoute = read("app/api/creator-music/route.ts");
const acquisitionRoute = read("app/api/creator-music/acquire/route.ts");
const migration = read("supabase/migrations/20260811_audio_p1_creator_music_entitlements.sql");
const exportHandler = exportService.slice(exportService.indexOf('app.post("/export-movie"'));
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks += 1; };

const executableService = service
  .replace(/import \{ normalizeCreatorPremiumMusicTrackId \} from "\.\/musicLibrary";/, `const normalizeCreatorPremiumMusicTrackId = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._~:-]{0,127}$/.test(value) ? value : undefined;`)
  .replace(/import \{ getPersistenceServices \} from "@\/lib\/persistence";/, "const getPersistenceServices = () => { throw new Error('unused'); };")
  .replace(/import \{ getMusicProvider, type MusicProvider \} from "@\/lib\/providers\/music";/, "const getMusicProvider = () => { throw new Error('unused'); };")
  .replace(/import \{ isPremiumMusicAcquisitionEnabled, MAX_PREMIUM_MUSIC_DOWNLOAD_BYTES, PREMIUM_MUSIC_CONTENT_TYPE \} from "@\/lib\/providers\/music\/downloadSecurity";/, `const isPremiumMusicAcquisitionEnabled = () => false; const MAX_PREMIUM_MUSIC_DOWNLOAD_BYTES = 30 * 1024 * 1024; const PREMIUM_MUSIC_CONTENT_TYPE = "audio/mpeg";`);
const compiled = ts.transpile(executableService, { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 });
const domain = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const userId = "11111111-1111-4111-8111-111111111111";
const projectId = "creator-project-1";
const trackId = "track-1";
const entitlement = {
  id: "22222222-2222-4222-8222-222222222222", userId, projectId, trackId,
  providerKey: domain.CREATOR_PREMIUM_MUSIC_PROVIDER_KEY,
  licensePolicyVersion: domain.CREATOR_PREMIUM_MUSIC_LICENSE_POLICY_VERSION,
  status: "acquired", storageBucket: "creator-premium-music",
  storagePath: `creator/${userId}/music/22222222-2222-4222-8222-222222222222/${"a".repeat(64)}.mp3`,
  contentType: "audio/mpeg", sizeBytes: 4, checksum: "a".repeat(64),
  providerLicenseMetadata: {}, createdAt: "now", updatedAt: "now", acquiredAt: "now",
};
let repoCalls = 0;
const dependencies = (record = entitlement, project = { id: projectId, flow_type: "creator_lab" }, enabled = true, bucket = "creator-premium-music") => ({
  acquisitionEnabled: enabled, privateBucket: bucket,
  projectRepository: { getForOwner: async () => project },
  entitlementRepository: { getByKeyForOwner: async () => { repoCalls += 1; return record; } },
});
const resolve = (record, project, enabled, bucket) => domain.resolveCreatorPremiumMusicExportEntitlement(
  { userId, projectId, trackId }, dependencies(record, project, enabled, bucket),
);

repoCalls = 0;
check(await resolve(entitlement, undefined, false) === null && repoCalls === 0, "1 disabled remains blocked");
check(route.indexOf("isPremiumMusicAcquisitionEnabled") < route.indexOf("reserveMeteredOperation(request"), "2 disabled before credit");
check(/normalizeCreatorPremiumMusicTrackId\(input\.trackId\)/.test(service), "3 track normalized");
check(await resolve(entitlement, null) === null, "4 ownership required");
check(await resolve(entitlement, { id: projectId, flow_type: "storyverse" }) === null, "5 CreatorLab required");
check(await resolve(null) === null, "6 missing blocked");
check(await resolve({ ...entitlement, status: "pending" }) === null, "7 pending blocked");
check(await resolve({ ...entitlement, status: "failed" }) === null, "8 failed blocked");
check(await resolve({ ...entitlement, status: "revoked" }) === null, "9 revoked blocked");
check((await resolve(entitlement))?.entitlementId === entitlement.id, "10 acquired accepted");
check(await resolve({ ...entitlement, storagePath: undefined }) === null, "11 incomplete blocked");
check(await resolve(entitlement, undefined, true, "wrong-bucket") === null, "12 bucket blocked");
check(await resolve({ ...entitlement, contentType: "audio/wav" }) === null, "13 type blocked");
check(await resolve({ ...entitlement, checksum: "bad" }) === null, "14 checksum blocked");
check(/delete exportPayload\.musicEntitlement/.test(route), "15 browser entitlement removed");
check(!/storageBucket/.test(route), "16 bucket injection absent");
check(!/storagePath/.test(route), "17 path injection absent");
check(!/body\.providerKey/.test(route), "18 provider injection absent");
check(!/body\.licensePolicyVersion/.test(route), "19 policy injection absent");
check(/return \{ entitlementId: entitlement\.id, trackId \}/.test(service), "20 minimal contract");

check(/VELTO_INTERNAL_EXPORT_TOKEN/.test(route + exportService), "21 token required for entitlement");
check(/if \(!configuredToken \|\| suppliedToken !== configuredToken\)/.test(exportService), "22 missing config closed");
check(/req\.get\("x-velto-internal-export-token"\) \|\| ""/.test(exportService), "23 missing header rejected");
check(/suppliedToken !== configuredToken/.test(exportService), "24 wrong header rejected");
check(/suppliedToken !== configuredToken[\s\S]*getSupabaseAdmin/.test(exportService), "25 exact token reaches resolution");
check(!/console\.(?:log|warn|error)\([^\n]*internalExportToken|console\.(?:log|warn|error)\([^\n]*configuredToken/.test(route + exportService), "26 token not logged");
check(/if \(!contract\) return ""/.test(exportService), "27 ordinary export compatible");

check(/row\.status !== "acquired"/.test(exportService), "28 acquired row");
check(/row\.track_id !== trackId/.test(exportService), "29 track match");
check(/row\.project_id !== projectId/.test(exportService), "30 project match");
check(/row\.provider_key !== CREATOR_PREMIUM_MUSIC_PROVIDER_KEY/.test(exportService), "31 provider match");
check(/row\.license_policy_version !== CREATOR_PREMIUM_MUSIC_LICENSE_POLICY_VERSION/.test(exportService), "32 policy match");
check(/row\.storage_bucket !== configuredBucket/.test(exportService), "33 bucket match");
check(/storagePath !== canonicalPath/.test(exportService), "34 canonical path");
check(/\$\{row\.checksum\}\.mp3/.test(exportService), "35 checksum path");
check(/storagePath\.includes\("\.\."\)[\s\S]*storagePath\.includes\("\\\\"\)/.test(exportService), "36 traversal blocked");
check(/canonicalPath = `creator\/\$\{row\.user_id\}\/music\/\$\{row\.id\}\/\$\{row\.checksum\}\.mp3`/.test(exportService), "37 MP3 only");
check(/downloadError \|\| !privateObject/.test(exportService), "38 missing object");
check(/privateObject\.size > MAX_PREMIUM_MUSIC_DOWNLOAD_BYTES/.test(exportService), "39 oversize object");
check(/privateObject\.size < 1/.test(exportService), "40 empty object");
check(/!isMp3\(buffer\)[\s\S]*createHash\("sha256"\)/.test(exportService), "41 corrupt object");
check(/return localPath/.test(exportService) && /\? privateCreatorMusicPath/.test(exportService), "42 local bgm path");
check(!/contract\.(?:storageBucket|storagePath)/.test(exportService), "43 request storage ignored");
check(!/providerUrl|downloadUrl/.test(exportService.slice(exportService.indexOf("resolvePrivateCreatorMusicAsset"), exportService.indexOf('app.get("/health"'))), "44 provider URL absent");

check(!/CREATOR_MUSIC_ASSET_BY_ID/.test(exportService), "45 static map removed");
check(["-stream_loop", "sidechaincompress", "afade=t=in", "afade=t=out", "preserveProgramLevel"].every((marker) => exportService.includes(marker)), "46 mix preserved");
check(/operationType: "creator_export"/.test(route), "47 export credit unchanged");
check(!/creator_music/.test(policy), "48 no music credit");
check(/searchTracks/.test(musicRoute) && /getTrackPreview/.test(musicRoute), "49 catalog unchanged");
check(!/creator-music\/acquire|downloadTrack/.test(route), "50 acquisition not called");
check(/if \(!contract\) return ""/.test(exportService) && /: path\.join\(process\.cwd\(\), "assets", "bgm\.mp3"\)/.test(exportService), "51 Storyverse compatible");
check(!/migration|db push|supabase migration/.test(route + exportService), "52 migration not executed");
check(!/storageBucket|storagePath|providerLicenseMetadata/.test(route.slice(route.indexOf("return NextResponse.json({\n      ...data"))), "53 private identity not returned");

check(/selectedCreatorMusicRequested && !body\.musicEntitlement[\s\S]*res\.status\(409\)/.test(exportHandler), "54 selected without entitlement rejected");
check(/body\.backgroundMusic\.mode === "selected"[\s\S]*!body\.musicEntitlement/.test(exportHandler), "55 selectedTrackId alone cannot authorize");
check(/Premium music must be confirmed before final export\./.test(exportHandler), "56 legacy browser selected request safely rejected");
check(/body\.musicEntitlement && !selectedCreatorMusicRequested[\s\S]*res\.status\(403\)/.test(exportHandler) && /resolvePrivateCreatorMusicAsset\(\{ req, body, tempDir \}\)/.test(exportHandler), "57 selected valid internal path accepted");
check(/productProfile === "creatorlab"[\s\S]*backgroundMusic\.mode === "selected"/.test(exportHandler), "58 CreatorLab no-music remains compatible");
check(/body\?\.productProfile === "creatorlab"/.test(exportHandler) && /: path\.join\(process\.cwd\(\), "assets", "bgm\.mp3"\)/.test(exportHandler), "59 Storyverse remains compatible");
check(exportHandler.indexOf("selectedCreatorMusicRequested && !body.musicEntitlement") < exportHandler.indexOf("resolvePrivateCreatorMusicAsset({ req, body, tempDir })"), "60 rejection before entitlement DB/storage");
check(exportHandler.indexOf("selectedCreatorMusicRequested && !body.musicEntitlement") < exportHandler.indexOf("const exportFlowValidation") && exportHandler.indexOf("selectedCreatorMusicRequested && !body.musicEntitlement") < exportHandler.indexOf("for (let i = 0; i < usableScenes.length"), "61 rejection before render work");
check(/if \(!contract\) return ""[\s\S]*x-velto-internal-export-token/.test(exportService), "62 token remains entitlement-specific");
check(!/selectedCreatorMusicRequested[\s\S]{0,240}(?:storageBucket|storagePath|providerKey|providerUrl|assetUrl)/.test(exportHandler) && /contractKeys\.join\(","\) !== "entitlementId,trackId"/.test(exportService), "63 injected storage/provider fields cannot authorize");

assert.equal(checks, 63);
console.log(`CreatorLab premium music export entitlement smoke passed (${checks}/63).`);
