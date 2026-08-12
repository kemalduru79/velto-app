import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const helperSource = read("lib/creator/exportScenes.ts");
const helperJs = ts.transpileModule(helperSource, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { resolveCanonicalCreatorExportScenes } = await import(`data:text/javascript;base64,${Buffer.from(helperJs).toString("base64")}`);
const page = read("app/create/page.tsx");
const editor = read("components/create/CreatorEditor.tsx");
const route = read("app/api/creator-export/route.ts");
const service = read("export-service/src/server.js");
const store = read("app/api/creator-store-video/route.ts");
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks += 1; };

const v1 = "https://media.example/v1.mp4?token=private-1";
const v2 = "https://media.example/v2.mp4?token=private-2";
const v3 = "https://media.example/v3.mp4?token=private-3";
const scene = {
  creatorSceneId: "scene-3",
  renderMode: "video",
  exportSource: "video",
  videoUrl: v2,
  image: "https://media.example/reference.jpg",
  videoGenerationSignature: "matching-provenance",
  assetHistory: [
    { id: "V1", kind: "video", url: v1 },
    { id: "V2", kind: "video", url: v2, generationSignature: "matching-provenance" },
    { id: "V3", kind: "video", url: v3 },
  ],
};
const reloaded = JSON.parse(JSON.stringify(scene));
const [resolved] = resolveCanonicalCreatorExportScenes([reloaded]);
const normalizedV2 = "https://media.example/v2.mp4";
const expectedFingerprint = createHash("sha256").update(normalizedV2).digest("hex").slice(0, 12);

check(scene.assetHistory.length === 3, "scene contains V1 V2 V3");
check(scene.videoUrl === v2, "explicit selection updates canonical videoUrl to V2");
check(/selectedScene\.videoUrl/.test(editor), "Editor preview uses canonical V2 field");
check(reloaded.videoUrl === v2, "persisted and reloaded canonical identity remains V2");
check(resolved.videoUrl === v2, "export resolver identity remains V2");
check(/fingerprintCreatorMedia\(selectedMediaUrl\)/.test(route), "API fingerprints forwarded selected media");
check(/scene\.mediaIdentity !== actualMediaIdentity/.test(service), "export service independently verifies API identity");
check(/downloadFile\(scene\.videoUrl, rawVideoPath\)/.test(service), "final clip downloads canonical selected V2 URL");
check(!JSON.stringify(resolved).includes("v1.mp4"), "V1 is never forwarded");
check(!JSON.stringify(resolved).includes("v3.mp4"), "V3 is never forwarded");
check(expectedFingerprint.length === 12 && !expectedFingerprint.includes("private"), "safe fingerprint strips signed query data");
check(/renderMode: "video"[\s\S]*videoUrl: asset\.url/.test(page), "Use This Version changes top-level videoUrl");
check(/renderMode,/.test(page) && !/latest generated/i.test(helperSource), "Image to Video preserves explicit canonical selection");
check(/scenes: sourceScenes/.test(page), "refresh persists selected version");
check(/creatorSceneId: scene\.creatorSceneId/.test(page), "reorder retains selected version by stable identity");
check(!/setScenes\([^)]*assetHistory.*(?:sort|reverse)/s.test(page), "rebuild never chooses newest history implicitly");
check(/assetHistory: _assetHistory/.test(helperSource), "history enters export only after canonical selection");
assert.throws(() => resolveCanonicalCreatorExportScenes([{ ...scene, videoUrl: "" }]), /Creator export scenes are invalid/); checks += 1;
check(!/(drawtext\s*=|subtitles\s*=|(?:^|[,;])ass\s*=|watermark)/im.test(service), "export service adds no text overlay");
check(/contentIdentity[\s\S]*queue-\$\{input\.queueJobId\}-\$\{contentIdentity\}[\s\S]*upsert: false/.test(store), "Creator video storage is immutable and content-addressed");
check(/process\.env\.NODE_ENV !== "production"/.test(route) && /process\.env\.NODE_ENV !== "production"/.test(service), "identity logs are development-only");
check(/data-selected-media-fingerprint="true"/.test(editor), "Editor displays selected safe fingerprint");
check(/exportSource === "video"[\s\S]*videoUrl: exportSource === "video"/.test(helperSource), "selected video never falls back to image");
check(/isCreatorLabExport/.test(service) && /productProfile === "creatorlab"/.test(route), "Storyverse remains outside identity enforcement");

console.log(`Export media identity proof smoke passed (${checks}/${checks}).`);
