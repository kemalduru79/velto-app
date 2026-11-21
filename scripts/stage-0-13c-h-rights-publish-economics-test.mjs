import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const renderability = read("lib/creator/audioRenderability.server.ts");
const publishAuthority = read("lib/creator/publishReadiness.server.ts");
const exportRoute = read("app/api/creator-export/route.ts");
const packageRoute = read("app/api/export-creator-package/route.ts");
const acquireRoute = read("app/api/creator-music/acquire/route.ts");
const acquisitionEconomics = read("lib/creator/musicAcquisitionEconomics.server.ts");
const entitlement = read("lib/creator/musicEntitlement.ts");
const usage = read("lib/creator/musicUsage.ts");
const usageRepository = read("lib/persistence/music/supabaseCreatorMusicUsageEventRepository.ts");
const page = read("app/create/page.tsx");
const readinessRoute = read("app/api/creator-publish-readiness/route.ts");
const sceneSelection = read("lib/creator/finalSceneExportSelection.ts");

// One server rights/renderability authority is shared by final render and delivery.
assert.match(renderability, /resolveCreatorAudioRenderability/);
assert.match(exportRoute, /resolveCreatorAudioRenderability\(\{/);
assert.match(publishAuthority, /resolveCreatorAudioRenderability\)\(\{/);
assert.doesNotMatch(exportRoute, /resolveCreatorPremiumMusicExportEntitlement/);

// Active verified/attested assets can proceed; preview, stale, unresolved, and invalid rights fail closed.
assert.match(renderability, /placement\.status !== "active" \|\| !placement\.asset/);
assert.match(renderability, /\["verified", "creator_attested"\]\.includes\(placement\.asset\.rights\.status\)/);
assert.match(renderability, /placement\.asset\.origin !== "licensed_catalog"/);
assert.match(renderability, /resolveCreatorPremiumMusicExportEntitlement/);
assert.match(entitlement, /entitlement\.status !== "acquired"/);
assert.match(entitlement, /getForOwner\(input\.projectId, input\.userId\)/);
assert.match(entitlement, /entitlement\.storagePath !== canonicalPath/);
assert.doesNotMatch(renderability, /previewUrl|streamUrl/);

// Publish authority is owner/project bound, signature-current, storage-backed, and rights-current.
assert.match(publishAuthority, /getForOwner\(input\.projectId, input\.ownerUserId\)/);
assert.match(publishAuthority, /canonical\.signature !== finalVideoSignature/);
assert.match(publishAuthority, /requestedFinalVideoUrl[\s\S]*!== finalVideoUrl/);
assert.match(publishAuthority, /findByPublicUrl\(input\.ownerUserId, finalVideoUrl\)/);
assert.match(publishAuthority, /finalAsset\.metadata\?\.projectId !== input\.projectId/);
assert.match(publishAuthority, /resolveCreatorFinalSceneExportSelections/);
assert.doesNotMatch(publishAuthority, /function sceneExportSource/);
assert.match(packageRoute, /resolveCreatorPublishAuthority\(\{/);
assert.ok(packageRoute.indexOf("resolveCreatorPublishAuthority({") < packageRoute.indexOf("createCreatorPublishReadyPackageReport({"));
assert.match(packageRoute, /code: "CREATOR_PUBLISH_NOT_READY"/);
assert.match(packageRoute, /publishAuthority\.finalVideoUrl/);
assert.doesNotMatch(packageRoute.slice(packageRoute.indexOf('code: "CREATOR_PUBLISH_NOT_READY"'), packageRoute.indexOf("createCreatorPublishReadyPackageReport")), /entitlementId|providerKey|storagePath/);

// UI state is simple and requires the current signature, while the server remains authoritative.
assert.match(page, /label: uiLanguage === "en" \? "Final video is current"/);
assert.match(readinessRoute, /resolveCreatorPublishAuthority/);
assert.match(page, /\/api\/creator-publish-readiness\?projectId=/);
assert.match(page, /ready: creatorServerPublishReadiness\.ready/);
assert.match(sceneSelection, /selectedTreatment === "ai_video" \? "video" : "image"/);
assert.match(publishAuthority, /"Your production changed\. Rebuild the final video\."/);
assert.doesNotMatch(page, /creator-facing credits|provider cost|entitlement ID|storage path/i);

// Acquisition and render accounting are successful-operation-only and idempotent.
assert.match(acquireRoute, /const acquisition = await acquireCreatorPremiumMusic/);
assert.match(acquireRoute, /await recordCreatorMusicAcquisitionEconomics\(\{ acquisition, userId: principal\.id, projectId: input\.projectId \}\)/);
assert.match(acquisitionEconomics, /if \(input\.acquisition\.reused\) return/);
assert.match(acquisitionEconomics, /creator-music-acquisition:\$\{entitlement\.id\}/);
assert.match(acquisitionEconomics, /state: "provider_billed"/);
assert.match(acquisitionEconomics, /attemptKey: `\$\{logicalOperationId\}:1`/);
assert.match(exportRoute, /state: "provider_billed"/);
assert.ok(exportRoute.indexOf("await registerCreatorMusicExportUsage") > exportRoute.indexOf("if (!response.ok"));
assert.match(usage, /createHash\("sha256"\)/);
assert.match(usageRepository, /onConflict: "entitlement_id,export_usage_key", ignoreDuplicates: true/);
assert.match(usageRepository, /\.in\("status", \["pending", "failed"\]\)/);
assert.doesNotMatch(acquireRoute, /providerKey|licensePolicyVersion|storagePath|NextResponse\.json\([^\n]*entitlement|NextResponse\.json\([^\n]*provider|NextResponse\.json\([^\n]*cost/);

console.log("STAGE_0_13C_H_RIGHTS_PUBLISH_ECONOMICS=PASS");
