import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getCreatorStockFormatPolicy,
  isRenditionCompatibleWithCreatorFormat,
  isStoredStockRenditionReusable,
  rankCreatorFormatRenditions,
} from "../lib/providers/stock/formatPolicy.ts";
import { rankStockCandidates } from "../lib/creator/productionIntelligence.ts";

const rendition = (id, width, height, quality = "production") => ({ id, width, height, quality, url: `https://videos.pexels.com/${id}.mp4`, mimeType: "video/mp4" });
const landscape1080 = rendition("landscape-1080", 1920, 1080);
const landscape720 = rendition("landscape-720", 1280, 720);
const portrait1080 = rendition("portrait-1080", 1080, 1920);
const portrait720 = rendition("portrait-720", 720, 1280);
const square = rendition("square", 1600, 1600);
const fourByThree = rendition("four-by-three", 1920, 1440);

assert.deepEqual(getCreatorStockFormatPolicy("youtube_video"), { orientation: "landscape", minimumWidth: 1280, minimumHeight: 720, preferredWidth: 1920, preferredHeight: 1080 });
assert.deepEqual(getCreatorStockFormatPolicy("short_form"), { orientation: "portrait", minimumWidth: 720, minimumHeight: 1280, preferredWidth: 1080, preferredHeight: 1920 });
assert.equal(rankCreatorFormatRenditions([portrait1080, landscape720, landscape1080], "youtube_video")[0].id, "landscape-1080", "YouTube chooses preferred 1920x1080 regardless of provider order");
assert.equal(rankCreatorFormatRenditions([fourByThree, landscape720], "youtube_video")[0].id, "landscape-720", "aspect-ratio fit outranks a larger 4:3 rendition");
assert.equal(rankCreatorFormatRenditions([landscape1080, portrait720, portrait1080], "short_form")[0].id, "portrait-1080", "short form chooses preferred 1080x1920 regardless of provider order");
assert.equal(rankCreatorFormatRenditions([square, portrait1080], "youtube_video").length, 0, "portrait and square cannot enter automatic YouTube import");
assert.equal(rankCreatorFormatRenditions([square, landscape1080], "short_form").length, 0, "landscape and square cannot enter automatic short-form import");
assert.equal(isRenditionCompatibleWithCreatorFormat(landscape720, "youtube_video"), true);
assert.equal(isRenditionCompatibleWithCreatorFormat(portrait720, "short_form"), true);
assert.equal(isRenditionCompatibleWithCreatorFormat(rendition("too-small", 1279, 719), "youtube_video"), false);

const validLandscapeReuse = {
  renditionId: "landscape-1080",
  renditionWidth: 1920,
  renditionHeight: 1080,
};
const legacySubstitutedPortraitReuse = {
  // The old resolver could build reuseIdentity from landscape-1080 but persist
  // a different actual rendition after substitution.
  renditionId: "portrait-1080",
  renditionWidth: 1080,
  renditionHeight: 1920,
};
const legacyWrongDimensionsReuse = {
  renditionId: "landscape-1080",
  renditionWidth: 1080,
  renditionHeight: 1920,
};

assert.equal(
  isStoredStockRenditionReusable(
    validLandscapeReuse,
    "landscape-1080",
    "youtube_video",
  ),
  true,
  "matching persisted landscape rendition is reusable for YouTube",
);

assert.equal(
  isStoredStockRenditionReusable(
    legacySubstitutedPortraitReuse,
    "landscape-1080",
    "youtube_video",
  ),
  false,
  "legacy substituted rendition ID must never reuse under the requested landscape identity",
);

assert.equal(
  isStoredStockRenditionReusable(
    legacyWrongDimensionsReuse,
    "landscape-1080",
    "youtube_video",
  ),
  false,
  "automatic YouTube reuse must fail closed when persisted dimensions are portrait",
);

assert.equal(
  isStoredStockRenditionReusable(
    { renditionId: "landscape-1080" },
    "landscape-1080",
    "youtube_video",
  ),
  false,
  "legacy automatic reuse without actual rendition dimensions must fail closed",
);

assert.equal(
  isStoredStockRenditionReusable(
    { renditionId: "portrait-1080", renditionWidth: 1080, renditionHeight: 1920 },
    "portrait-1080",
  ),
  true,
  "manual exact-rendition reuse remains valid without automatic format enforcement",
);

assert.equal(
  isStoredStockRenditionReusable(
    { renditionId: "portrait-1080", renditionWidth: 1080, renditionHeight: 1920 },
    "landscape-1080",
  ),
  false,
  "manual reuse must still preserve exact requested rendition identity",
);

const candidate = (providerMediaId, renditions, orientation) => ({ providerMediaId, renditions, orientation, mediaType: "video", durationSeconds: 10 });
const decision = { stockIntent: { mediaType: "video", orientation: "landscape", minimumDurationSeconds: 5 } };
assert.equal(rankStockCandidates(decision, [candidate("first", [landscape720], "landscape"), candidate("second", [landscape1080], "landscape")], "youtube_video")[0].rendition.id, "landscape-1080", "candidate ranking uses the best importable rendition instead of provider order");
assert.equal(rankStockCandidates(decision, [candidate("misleading-metadata", [portrait1080], "landscape")], "youtube_video").length, 0, "candidate metadata cannot mask an incompatible import rendition");

const page = readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const provider = readFileSync(new URL("../lib/providers/stock/pexels.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/creator-stock/import/route.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("../lib/providers/stock/service.server.ts", import.meta.url), "utf8");
const metadata = readFileSync(new URL("../lib/providers/stock/sourceMetadata.ts", import.meta.url), "utf8");
const execution = readFileSync(new URL("../lib/creator/recommendedVisualExecution.ts", import.meta.url), "utf8");

assert.match(page, /orientation: automaticFormat === "youtube_video" \? "landscape" : "portrait"/);
assert.match(page, /rankStockCandidates\([^;]+automaticFormat\)/s);
assert.match(page, /renditionId: selection\.rendition\.id, automaticFormat/);
assert.match(route, /body\.automaticFormat === "youtube_video" \|\| body\.automaticFormat === "short_form"/);
assert.match(route, /"downloadUrl" in body \|\| "url" in body/);
assert.match(service, /resolveImportRendition\(candidate, input\.renditionId, input\.automaticFormat\)/);
assert.match(service, /isStoredStockRenditionReusable/);
assert.match(service, /STOCK_IMPORT_REUSE_INVALIDATION_FAILED/);
assert.match(service, /reuseIdentity = createHash\("sha256"\).*input\.renditionId/);
assert.match(provider, /if \(automaticFormat && !isRenditionCompatibleWithCreatorFormat\(selected, automaticFormat\)\) throw/);
assert.match(provider, /return selected;/, "manual and compatible automatic imports preserve the requested rendition exactly");
assert.doesNotMatch(provider, /Math\.max\(item\.width, item\.height\)/, "dimension-swapping replacement heuristic is removed");
assert.match(metadata, /renditionOrientation/);
assert.match(metadata, /renditionAspectRatio/);
assert.match(execution, /const stock = await input\.acquireStock/);
assert.match(execution, /if \(!stock\) continue;/, "stock failure remains eligible for the existing bounded fallback chain");

console.log("Stage 0.20C1 stock rendition integrity regression passed.");
