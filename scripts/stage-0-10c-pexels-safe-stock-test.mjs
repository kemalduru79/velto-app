import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectPexelsVideoPreview } from "../lib/providers/stock/pexelsPreview.ts";
import { createPinnedDnsLookup } from "../lib/security/pinnedDnsLookup.ts";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const provider = read("lib/providers/stock/pexels.ts"); const service = read("lib/providers/stock/service.server.ts");
const search = read("app/api/creator-stock/search/route.ts"); const importer = read("app/api/creator-stock/import/route.ts");
const sourceMetadata = read("lib/providers/stock/sourceMetadata.ts");
const migration = read("supabase/migrations/20260822150000_stage_0_10c_pexels_safe_stock.sql"); const picker = read("components/create/CreatorStockPicker.tsx");
assert.match(provider, /import "server-only"/); assert.doesNotMatch(picker, /PEXELS_API_KEY/); assert.doesNotMatch(search, /apiKey|Authorization:\s*process\.env/); assert.doesNotMatch(importer, /apiKey|Authorization:\s*process\.env/);
assert.match(provider, /"\/search"/); assert.match(provider, /"\/videos\/search"/); assert.match(provider, /`\/videos\/videos\/\$\{providerMediaId\}`/);
assert.match(service, /trim\(\)\.replace\(\/\\s\+\/g, " "\)\.toLocaleLowerCase/); assert.match(service, /24 \* 60 \* 60 \* 1000/); assert.match(service, /cacheStatus: "hit"/); assert.match(service, /gt\("expires_at"/);
assert.match(service, /STOCK_SEARCH_CACHE_SCHEMA_VERSION = "pexels-video-preview-v2"/); assert.match(service, /JSON\.stringify\(\[STOCK_SEARCH_CACHE_SCHEMA_VERSION,/);
assert.match(provider, /x-ratelimit/i); assert.match(provider, /response\.status === 429/); assert.match(provider, /response\.status === 401 \|\| response\.status === 403/); assert.match(provider, /AbortSignal\.timeout/); assert.match(provider, /STOCK_MALFORMED_RESPONSE/);
assert.match(service, /PEXELS_MEDIA_HOSTS/); assert.match(service, /safeRemoteMediaFetch/); assert.match(importer, /"downloadUrl" in body \|\| "url" in body/); assert.match(service, /checkStorageGenerationAllowance/);
assert.match(migration, /unique\(owner_user_id, project_id, reuse_identity\)/); assert.match(service, /getForOwner\(String\(existing\.asset_id\), input\.userId\)/); assert.match(service, /sourceMetadata/); assert.match(sourceMetadata, /licenseSnapshotDate/);
assert.match(service, /costStatus: "not_billable"/); assert.match(service, /providerCostUsd: 0/); assert.match(service, /downloadedBytes/); assert.match(service, /storageBytes/); assert.match(service, /generated: false/);
assert.doesNotMatch(picker, /Search Pexels|Stock media · Pexels/); assert.match(picker, /attributionText/); assert.match(picker, /separate rights/); assert.match(picker, /Import & use/);
const videoPreview = selectPexelsVideoPreview([
  { file_type: "video/mp4", link: "https://videos.pexels.com/video-files/42/42-hd_1920_1080_30fps.mp4", width: 1920, height: 1080 },
  { file_type: "video/mp4", link: "https://videos.pexels.com/video-files/42/42-sd_640_360_30fps.mp4", width: 640, height: 360 },
], [{ picture: "https://images.pexels.com/videos/42/poster.jpeg" }]);
assert.equal(videoPreview.previewUrl, "https://videos.pexels.com/video-files/42/42-sd_640_360_30fps.mp4"); assert.equal(videoPreview.previewPosterUrl, "https://images.pexels.com/videos/42/poster.jpeg"); assert.doesNotMatch(videoPreview.previewUrl, /\.jpe?g$/i);
assert.equal(selectPexelsVideoPreview([{ file_type: "image/jpeg", link: "https://images.pexels.com/broken.jpeg", width: 640, height: 360 }], [{ picture: "https://images.pexels.com/poster.jpeg" }]).previewUrl, null);
assert.equal(selectPexelsVideoPreview([{ file_type: "video/mp4", link: "https://evil.example/preview.mp4", width: 640, height: 360 }], []).previewUrl, null);

const livePhotoFixture = new URL("https://images.pexels.com/photos/12377231/pexels-photo-12377231.jpeg?auto=compress&cs=tinysrgb&h=650&w=940");
const liveVideoFixture = new URL("https://videos.pexels.com/video-files/10395606/10395606-sd_360_640_24fps.mp4");
assert.equal(livePhotoFixture.hostname, "images.pexels.com");
assert.equal(liveVideoFixture.hostname, "videos.pexels.com");
assert.equal(livePhotoFixture.protocol, "https:");
assert.equal(liveVideoFixture.protocol, "https:");
const selectedAddress = { address: "104.18.66.220", family: 4 };
const lookup = createPinnedDnsLookup(selectedAddress);
let allLookupResult;
lookup("images.pexels.com", { all: true }, (error, addresses) => { allLookupResult = { error, addresses }; });
assert.deepEqual(allLookupResult, { error: null, addresses: [selectedAddress] }, "Node all-address lookup must receive an address array");
let scalarLookupResult;
lookup("videos.pexels.com", { all: false }, (error, address, family) => { scalarLookupResult = { error, address, family }; });
assert.deepEqual(scalarLookupResult, { error: null, address: selectedAddress.address, family: 4 });
assert.match(service, /assertPexelsMediaUrl\(input\.url\)/);
assert.match(importer, /CREATOR_STOCK_DOWNLOAD_FAILED/);
assert.match(importer, /category: error\.category/);
assert.match(provider, /previewUrl: text\(src\.medium\) \|\| text\(src\.large\)/); assert.match(provider, /\.filter\(\(item\) => item\.providerMediaId && item\.sourcePageUrl && item\.previewUrl && item\.renditions\.length\)/);
assert.match(provider, /return production\.filter\(\(item\) => Math\.max\(item\.width, item\.height\) <= 1920 && Math\.min\(item\.width, item\.height\) >= 720\)/);
assert.match(picker, /<video src=\{candidate\.previewUrl\} poster=\{candidate\.previewPosterUrl \|\| undefined\} controls preload="metadata"/); assert.doesNotMatch(picker, /autoPlay/);
const routing = read("lib/creator/mediaRouting.ts"); assert.match(routing, /standard[\s\S]*videoBlockRatio:\s*0/); assert.match(routing, /pro[\s\S]*videoBlockRatio:\s*0\.45/); assert.match(routing, /cinematic[\s\S]*videoBlockRatio:\s*0\.75/);
console.log("Stage 0.10C Pexels safe-stock contract checks passed.");
