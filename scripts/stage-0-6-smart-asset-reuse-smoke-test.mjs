import fs from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const read = (file) => fs.readFileSync(file, "utf8");
const helperSource = read("lib/creator/projectAssets.ts");
const component = read("components/create/CreatorProjectAssets.tsx");
const editor = read("components/create/CreatorEditor.tsx");
const page = read("app/create/page.tsx");
const saveRoute = read("app/api/save-project/route.ts");
const packageJson = JSON.parse(read("package.json"));

const transpiled = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helper = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`);

const scenes = [
  {
    id: 1,
    creatorSceneId: "scene-a",
    text: "Opening",
    image: "https://media.test/a.jpg?b=2&a=1#preview",
    videoUrl: "https://media.test/a.mp4",
    videoStatus: "done",
    assetHistory: [
      { id: "duplicate", kind: "image", url: "https://media.test/a.jpg?a=1&b=2", createdAt: "2026-01-01" },
      { id: "old", kind: "image", url: "https://media.test/old.jpg", createdAt: "2025-01-01" },
    ],
  },
  { id: 2, creatorSceneId: "scene-b", text: "Close", image: "https://media.test/b.jpg", assetHistory: [] },
];
const assets = helper.deriveCreatorProjectAssets(scenes);

check(assets.some((asset) => asset.kind === "image" && asset.url.includes("a.jpg")), "current images are represented");
check(assets.some((asset) => asset.kind === "image" && asset.url.endsWith("old.jpg")), "historical images are represented");
check(assets.filter((asset) => asset.kind === "image" && asset.url.includes("a.jpg")).length === 1, "URL/type duplicates are deduplicated");
check(assets.find((asset) => asset.url.includes("a.jpg"))?.version === "current", "current media wins over duplicate history");
check(/targetImageKey[\s\S]*isNoOp/.test(component) && /!isNoOp/.test(component), "current target image has no no-op reuse action");
check(/deriveCreatorProjectAssets\(scenes\)/.test(component), "Project Assets derives from same-project scene state");
check(/scene\.assetHistory/.test(helperSource) && /scene\.image/.test(helperSource), "inventory includes current and historical scene media");
check(/onRestoreMedia\(selectedScene\.creatorSceneId!, asset\.id\)/.test(editor), "Asset History remains wired");
check(/onRestoreMedia=/.test(page) && /restoreCreatorSceneAsset/.test(page), "existing onRestoreMedia remains");
check(/assetHistory/.test(saveRoute) === false && /scenes/.test(saveRoute), "save-project continues serializing complete scenes without a second asset store");
check(/normalizeCreatorAssetHistory/.test(page) && /loadedProjectScenes/.test(page), "persisted asset history remains normalized after load");
check(/onUseProjectImage=\{reuseCreatorProjectImage\}/.test(page), "focused-scene image reuse is wired independently");
check(!/creatorSelectedSceneIds[\s\S]{0,250}reuseCreatorProjectImage/.test(page), "reuse does not use bulk selection");
const reuseBlock = page.slice(page.indexOf("const reuseCreatorProjectImage"), page.indexOf("const acquireAutomaticStockForScene"));
check(!/fetch\(|creator-image|creator-video|CreatorCostGuard/.test(reuseBlock), "reuse invokes no generation or cost API");
check(/videoUrl: ""/.test(reuseBlock) && /videoGenerationSignature: undefined/.test(reuseBlock), "image reuse invalidates dependent video currentness");
check(!/audioUrl:|dialogueAudioUrl:|creatorSceneId:/.test(reuseBlock), "image reuse preserves voice currentness and stable scene identity");
check(/data-cross-scene-video-reuse="deferred"/.test(component) && !/Use video|Videoyu kullan/.test(component), "cross-scene video safety guard exists");
check(/getCreatorVideoState/.test(page) && /getCreatorNarrationAudioCurrentness/.test(page) && /getCreatorDialogueAudioCurrentness/.test(page), "existing video/audio currentness remains referenced");
check(/No generation credits used/.test(component) && /Üretim kredisi kullanılmaz/.test(component), "zero-credit message is present");
check(!/unsplash|pexels|pixabay|shutterstock|getty|storyblocks/i.test(helperSource + component), "no external stock provider introduced");
check(!/supabase|create table|migration/i.test(helperSource + component), "no database or schema requirement introduced");
check(
  createHash("sha256").update(JSON.stringify(packageJson.dependencies || {})).digest("hex") ===
    "a670e27e2b6e356c24ffa46a447496eb2ff287f37cbd503404f75ec2f715d2bd",
  "no package dependency introduced",
);
check(!reuseBlock.includes("CreatorCostGuard"), "CreatorCostGuard remains outside zero-credit reuse");
check(!/storyverse/i.test(helperSource + component + reuseBlock), "Storyverse is unaffected by Stage 0.6A implementation");

if (failures.length) {
  console.error(`Stage 0.6A smoke test failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Stage 0.6A smart asset reuse smoke test passed (24 checks).");
