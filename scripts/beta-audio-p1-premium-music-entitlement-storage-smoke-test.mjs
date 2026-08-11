import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260811_audio_p1_creator_music_entitlements.sql");
const types = read("lib/persistence/music/types.ts");
const repository = read("lib/persistence/music/supabaseCreatorMusicEntitlementRepository.ts");
const service = read("lib/creator/musicEntitlement.ts");
const route = read("app/api/creator-music/acquire/route.ts");
const storageTypes = read("lib/persistence/storage/types.ts");
const storage = read("lib/persistence/storage/supabaseObjectStorageRepository.ts");
const provider = read("lib/providers/music/epidemic.ts");
const creatorMusicRoute = read("app/api/creator-music/route.ts");
const exportRoute = read("app/api/creator-export/route.ts");
const executableService = service
  .replace(/import \{ normalizeCreatorPremiumMusicTrackId \} from "\.\/musicLibrary";/, `const normalizeCreatorPremiumMusicTrackId = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._~:-]{0,127}$/.test(value) ? value : undefined;`)
  .replace(/import \{ getPersistenceServices \} from "@\/lib\/persistence";/, "const getPersistenceServices = () => { throw new Error('unused'); };")
  .replace(/import \{ getMusicProvider, type MusicProvider \} from "@\/lib\/providers\/music";/, "const getMusicProvider = () => { throw new Error('unused'); };")
  .replace(/import \{ isPremiumMusicAcquisitionEnabled, PREMIUM_MUSIC_CONTENT_TYPE \} from "@\/lib\/providers\/music\/downloadSecurity";/, `const isPremiumMusicAcquisitionEnabled = () => false; const PREMIUM_MUSIC_CONTENT_TYPE = "audio/mpeg";`);
const transpiledService = ts.transpile(executableService, { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 });
const domain = await import(`data:text/javascript;base64,${Buffer.from(transpiledService).toString("base64")}`);

const userId = "11111111-1111-4111-8111-111111111111";
const projectId = "creator-project-1";
const entitlementId = "22222222-2222-4222-8222-222222222222";
const checksum = "a".repeat(64);
const counters = { provider: 0, storage: 0, acquired: 0 };
let record;
const fakeDependencies = {
  acquisitionEnabled: true,
  privateBucket: "creator-premium-music",
  projectRepository: { getForOwner: async () => ({ id: projectId, flow_type: "creator_lab" }) },
  entitlementRepository: {
    createOrGetPending: async (key) => {
      if (record) return { entitlement: record, created: false };
      record = { ...key, id: entitlementId, status: "pending", providerLicenseMetadata: {}, createdAt: "now", updatedAt: "now" };
      return { entitlement: record, created: true };
    },
    stageStoredAsset: async (_id, _user, asset) => (record = { ...record, ...asset }),
    markAcquired: async () => { counters.acquired += 1; return (record = { ...record, status: "acquired", acquiredAt: "now" }); },
  },
  objectStorage: { uploadPrivate: async ({ bucket, path }) => { counters.storage += 1; return { bucket, path }; } },
  provider: { downloadTrack: async () => { counters.provider += 1; return { body: Uint8Array.from([0x49, 0x44, 0x33, 0]), contentType: "audio/mpeg", contentLength: 4, checksum, providerAcquisitionId: "safe-id", licenseMetadata: { licenseType: "commercial", url: "https://unsafe.example" } }; } },
};
const acquiredResult = await domain.acquireCreatorPremiumMusic({ userId, projectId, trackId: "track-1" }, fakeDependencies);
const reusedResult = await domain.acquireCreatorPremiumMusic({ userId, projectId, trackId: "track-1" }, fakeDependencies);
const disabledCounters = { provider: 0, storage: 0 };
await assert.rejects(
  domain.acquireCreatorPremiumMusic({ userId, projectId, trackId: "track-1" }, {
    ...fakeDependencies,
    acquisitionEnabled: false,
    provider: { downloadTrack: async () => { disabledCounters.provider += 1; } },
    objectStorage: { uploadPrivate: async () => { disabledCounters.storage += 1; } },
  }),
  (error) => error.code === "disabled",
);
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks += 1; };

check(/create table if not exists public\.creator_music_entitlements/.test(migration), "schema table");
check(/status in \('pending', 'acquired', 'failed', 'revoked'\)/.test(migration), "status constraint");
check(/unique \([\s\S]*user_id, project_id, provider_key, track_id, license_policy_version/.test(migration), "identity uniqueness");
check(/enable row level security/.test(migration), "RLS");
check(!/create policy[\s\S]*\bto anon\b/i.test(migration), "no anonymous policy");
check(!/create policy[\s\S]*\bfor select\b[\s\S]*\bto authenticated\b/i.test(migration), "no authenticated SELECT policy");
check(!/create policy[\s\S]*\bfor (?:insert|update|delete|all)\b[\s\S]*\bto authenticated\b/i.test(migration), "no authenticated write policy");
check(/revoke all on table public\.creator_music_entitlements from anon;[\s\S]*revoke all on table public\.creator_music_entitlements from authenticated;[\s\S]*grant all on table public\.creator_music_entitlements to service_role;/.test(migration), "service role only grants");
check(/createServerSupabaseClient\(\)\.from\("creator_music_entitlements"\)/.test(repository), "server repository access boundary");
check(!/\b(drop|truncate|delete from|alter table public\.(?!creator_music_entitlements))\b/i.test(migration), "additive migration");
check(!/credit_ledger|credit_reservation|credit_account/.test(migration), "no credit schema");
check(!/storyverse/i.test(migration), "no Storyverse schema");

check(/"pending"[\s\S]*"acquired"[\s\S]*"failed"[\s\S]*"revoked"/.test(types), "domain statuses");
check(/creator-premium-music-license-v1/.test(service), "server policy version");
check(/onConflict: "user_id,project_id,provider_key,track_id,license_policy_version"/.test(repository), "DB idempotency");
check(/status === "acquired"[\s\S]*reused: true/.test(service), "acquired reuse");
check(/!created[\s\S]*in_progress/.test(service), "pending no duplicate");
check(/status === "failed"[\s\S]*CreatorMusicAcquisitionError\("failed"\)/.test(service), "controlled failed state");
check(/status === "revoked"[\s\S]*CreatorMusicAcquisitionError\("revoked"\)/.test(service), "revoked fail closed");
check(/\.eq\("id", id\)\.eq\("user_id", userId\)\.eq\("project_id", projectId\)/.test(repository), "cross-user rejection");
check(/getForOwner\(input\.projectId, input\.userId\)/.test(service), "cross-project rejection");
check(/normalizeCreatorPremiumMusicTrackId\(input\.trackId\)/.test(service), "track validation");

check(/PrivateObjectUploadResult = \{\s*bucket: string;\s*path: string;\s*\}/.test(storageTypes), "private identity only");
check(/CREATOR_PREMIUM_MUSIC_BUCKET/.test(service) && !/NEXT_PUBLIC_CREATOR_PREMIUM_MUSIC_BUCKET/.test(service), "server bucket");
check(/normalized\.includes\("\.\."\)[\s\S]*normalized\.startsWith\("\/"\)[\s\S]*normalized\.includes\("\\\\"\)/.test(storage), "unsafe path");
check(/input\.contentType !== "audio\/mpeg"/.test(storage), "MP3 content type");
check(/creator\/\$\{userId\}\/music\/\$\{entitlementId\}\/\$\{checksum\}\.mp3/.test(service), "deterministic object key");
check(/requirePrivateBucket\(dependencies\.privateBucket\)/.test(service), "missing bucket closed");
check(/async uploadPublic[\s\S]*getPublicUrl/.test(storage), "public upload compatible");
check(!/uploadPrivate/.test(read("app/api/image/route.ts")) && !/uploadPrivate/.test(read("app/api/creator-video/route.ts")), "existing media paths unchanged");

check(/env\.CREATOR_PREMIUM_MUSIC_ACQUISITION_ENABLED === "true"/.test(read("lib/providers/music/downloadSecurity.ts")), "disabled default");
check(disabledCounters.provider === 0, "disabled before provider");
check(disabledCounters.storage === 0, "disabled before storage");
check(!/providerKey/.test(route), "browser cannot set provider");
check(!/licensePolicyVersion/.test(route), "browser cannot set policy");
check(!/providerUrl|downloadUrl/.test(route), "browser cannot send provider URL");
check(!/storageUrl|storageBucket|storagePath/.test(route), "browser cannot send storage identity");
check(/getForOwner[\s\S]*flow_type[\s\S]*creator_lab/.test(service), "project owner and product required");
check(acquiredResult.status === "acquired" && counters.acquired === 1, "fake-capable success flow");
check(service.indexOf("uploadPrivate") < service.lastIndexOf("markAcquired"), "storage failure not acquired");
check(/const acquired = await dependencies\.entitlementRepository\.markAcquired/.test(service), "activation failure cannot report success");
check(reusedResult.reused === true && counters.provider === 1 && counters.storage === 1, "repeat no second acquisition");
check(record.providerLicenseMetadata.licenseType === "commercial" && !("url" in record.providerLicenseMetadata), "safe metadata only");
check(!/temporary|rawResponse|authorization|previewUrl|browserUrl/i.test(types + migration), "no raw/provider URL payload");

check(!/creator_music/.test(read("lib/credits/operationPolicy.ts")), "no creator_music credit operation");
check(/backgroundMusic\.mode === "selected"/.test(exportRoute) && /creator_premium_music_confirmation_required/.test(exportRoute), "premium export remains guarded");
check(/searchTracks/.test(provider) && /action === "auto"/.test(creatorMusicRoute), "search preserved");
check(/getTrackPreview/.test(provider) && /action === "preview"/.test(creatorMusicRoute), "preview preserved");
check(!/storyverse/i.test(service + route + types + repository), "CreatorLab-only foundation");

assert.equal(checks, 49);
console.log(`beta-audio-p1 premium music entitlement/storage smoke: ${checks} checks passed`);
