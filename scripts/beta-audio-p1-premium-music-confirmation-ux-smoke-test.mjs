import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { creatorCatalogTrackAsset, selectCatalogCreatorMusic, createDefaultCreatorMusicTimeline } from "../lib/creator/musicSetup.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/create/page.tsx");
const setup = read("components/create/CreatorBackgroundMusic.tsx");
const picker = read("components/create/CreatorMusicLibraryPicker.tsx");
const route = read("app/api/creator-music/acquire/route.ts");
const acquisition = read("lib/creator/musicEntitlement.ts");
const security = read("lib/providers/music/downloadSecurity.ts");

const checks = [];
const check = (condition, label) => {
  assert.ok(condition, label);
  checks.push(label);
};

check(/<CreatorMusicLibraryPicker/.test(setup), "canonical setup reuses the music library picker");
check(/selectCatalogCreatorMusic\(\{ timeline, track, sceneIds \}\)/.test(setup), "catalog selection enters the canonical AudioTimeline flow");
check(/action: autoOnly \? "auto" : "search"/.test(picker), "picker preserves catalog search and auto-match");
check(/action: "preview"/.test(picker) && /playingId === track\.id/.test(picker), "picker preserves track preview");
check(/Selected for this project\. Final use requires availability\./.test(setup), "unresolved catalog selection is disclosed");
check(/selectedMusic\?\.asset\?\.rights\.status === "unknown"/.test(setup) && /Review required/.test(setup), "unknown catalog rights remain review-gated");
check(/authenticateRequest/.test(route), "acquisition route remains authenticated");
check(/ALLOWED_BODY_KEYS = new Set\(\["productProfile", "projectId", "trackId"\]\)/.test(route), "acquisition request contract remains narrow");
check(/acquireCreatorPremiumMusic/.test(route), "acquisition route delegates to the entitlement boundary");
check(/if \(!dependencies\.acquisitionEnabled\) throw new CreatorMusicAcquisitionError\("disabled"\)/.test(acquisition), "commercial acquisition remains fail-closed");
check(/isPremiumMusicAcquisitionEnabled/.test(security), "provider download security retains the acquisition gate");
check(/MAX_PREMIUM_MUSIC_DOWNLOAD_BYTES/.test(security) && /PREMIUM_MUSIC_DOWNLOAD_TIMEOUT_MS/.test(security), "provider download remains bounded");
check(/validateProviderMusicUrl/.test(security) && /isUnsafeNetworkAddress/.test(security), "provider media URLs remain SSRF constrained");
check(!/EPIDEMIC_SOUND_API_KEY|partner-content-api/.test(picker + setup + page), "provider secrets and identity remain outside creator UI");
check(!/entitlementId|assetId|raw rights|COGS/.test(picker), "picker exposes no acquisition internals");
check(/!creatorProductionComplete[\s\S]*creatorNextProductionAction\.buttonLabel/.test(page), "Build Final Video remains present until production completes");

const track = { id: "opaque-track", title: "Calm Horizon", artist: "Artist", durationSec: 90, moods: [], genres: [], previewAvailable: true };
const asset = creatorCatalogTrackAsset(track);
check(asset.origin === "licensed_catalog" && asset.rights.status === "unknown", "catalog asset enters as provider-neutral unknown rights");
check(!("previewUrl" in asset) && !("streamUrl" in asset), "catalog asset persists no preview or stream URL");
const timeline = selectCatalogCreatorMusic({ timeline: createDefaultCreatorMusicTimeline(), track, sceneIds: ["scene-a", "scene-b"] });
check(timeline.placements[0].status === "unresolved", "catalog placement remains unresolved before acquisition");
check(timeline.placements[0].asset?.displayName === "Calm Horizon · Artist", "creator-facing track identity remains descriptive");

console.log(`Premium music confirmation UX smoke test passed (${checks.length} canonical checks).`);
