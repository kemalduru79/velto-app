import { execFileSync as sprint20GitShow } from "node:child_process";
import { readMountedWorkspacePanel } from "./fixtures/create-workspace-panel-authority.mjs";
import fs from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";

const production = readMountedWorkspacePanel("CreatorProductionPanel");
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
check(/onRestoreMedia=/.test(production) && /restoreCreatorSceneAsset/.test(page), "existing onRestoreMedia remains");
check(/assetHistory/.test(saveRoute) === false && /scenes/.test(saveRoute), "save-project continues serializing complete scenes without a second asset store");
check(/normalizeCreatorAssetHistory/.test(page) && /loadedProjectScenes/.test(page), "persisted asset history remains normalized after load");
check(/onUseProjectImage=\{reuseCreatorProjectImage\}/.test(production), "focused-scene image reuse is wired independently");
check(!/creatorSelectedSceneIds[\s\S]{0,250}reuseCreatorProjectImage/.test(page), "reuse does not use bulk selection");
const reuseBlock = page.slice(page.indexOf("const reuseCreatorProjectImage"), page.indexOf("const acquireAutomaticStockForScene"));
check(!/fetch\(|creator-image|creator-video|CreatorCostGuard/.test(reuseBlock), "reuse invokes no generation or cost API");
check(/videoUrl: ""/.test(reuseBlock) && /videoGenerationSignature: undefined/.test(reuseBlock), "image reuse invalidates dependent video currentness");
check(!/audioUrl:|dialogueAudioUrl:|creatorSceneId:/.test(reuseBlock), "image reuse preserves voice currentness and stable scene identity");
check(/data-cross-scene-video-reuse="deferred"/.test(component) && !/Use video|Videoyu kullan/.test(component), "cross-scene video safety guard exists");
check(/getCreatorVideoState/.test(page) && /getCreatorNarrationAudioCurrentness/.test(page) && /getCreatorDialogueAudioCurrentness/.test(page), "existing video/audio currentness remains referenced");
check(/No new generation/.test(component) && /Yeni üretim yapılmaz/.test(component), "zero-generation message is present");
check(!/unsplash|pexels|pixabay|shutterstock|getty|storyblocks/i.test(helperSource + component), "no external stock provider introduced");
check(!/supabase|create table|migration/i.test(helperSource + component), "no database or schema requirement introduced");
// Stage 0.6A originally had a fixed runtime dependency snapshot:
// SHA256 c78fdc671808f55bc3ef9be878c0f3920da3415bd45a483ece123b47f7c0408f.
// Later reviewed work legitimately added Geist; Sprint 20 only upgrades Next.
// Retain the "no new dependencies" requirement against Git HEAD, and reject
// every other version/addition/removal. P0 separately pins package.json bytes.
const sprint20BaselinePackage = JSON.parse(sprint20GitShow("git", ["show", "HEAD:package.json"], { encoding: "utf8" }));
const sprint20ReviewedPackageSha = "4fc0a29353bca1f0dba78ca3e3b6651926e697e6f48912d4ceb1986c28451b7e";
function sprint20MatchesOnlyApprovedUpgrade(candidate, baseline, changedKey, oldVersion, newVersion) {
  if (!candidate || !baseline || baseline[changedKey] !== oldVersion || candidate[changedKey] !== newVersion) return false;
  const keys = Object.keys(baseline);
  if (Object.keys(candidate).length !== keys.length) return false;
  return keys.every((key) => Object.prototype.hasOwnProperty.call(candidate, key) &&
    candidate[key] === (key === changedKey ? newVersion : baseline[key]));
}
check(
  createHash("sha256").update(fs.readFileSync("package.json")).digest("hex") === sprint20ReviewedPackageSha,
  "only the reviewed exact Sprint 20 package manifest is admitted",
);
check(
  sprint20MatchesOnlyApprovedUpgrade(packageJson.dependencies, sprint20BaselinePackage.dependencies, "next", "16.2.3", "16.4.6"),
  "no package dependency introduced; only reviewed Next.js upgrade admitted",
);
check(
  sprint20MatchesOnlyApprovedUpgrade(packageJson.devDependencies, sprint20BaselinePackage.devDependencies, "eslint-config-next", "16.2.3", "16.4.6"),
  "no unreviewed dev dependency introduced or changed",
);
check(
  !sprint20MatchesOnlyApprovedUpgrade({ ...packageJson.dependencies, "unreviewed-new-dependency": "1.0.0" }, sprint20BaselinePackage.dependencies, "next", "16.2.3", "16.4.6"),
  "negative control: added runtime dependency rejected",
);
check(
  !sprint20MatchesOnlyApprovedUpgrade({ ...packageJson.dependencies, next: "16.2.3" }, sprint20BaselinePackage.dependencies, "next", "16.2.3", "16.4.6"),
  "negative control: vulnerable Next.js downgrade rejected",
);
check(
  !sprint20MatchesOnlyApprovedUpgrade({ ...packageJson.dependencies, openai: "0.0.0" }, sprint20BaselinePackage.dependencies, "next", "16.2.3", "16.4.6"),
  "negative control: unrelated runtime dependency mutation rejected",
);
check(
  !sprint20MatchesOnlyApprovedUpgrade({ ...packageJson.devDependencies, "eslint-config-next": "16.2.3" }, sprint20BaselinePackage.devDependencies, "eslint-config-next", "16.2.3", "16.4.6"),
  "negative control: vulnerable Next.js ESLint config downgrade rejected",
);
check(!reuseBlock.includes("CreatorCostGuard"), "CreatorCostGuard remains outside zero-credit reuse");
check(!/storyverse/i.test(helperSource + component + reuseBlock), "Storyverse is unaffected by Stage 0.6A implementation");

if (failures.length) {
  console.error(`Stage 0.6A smoke test failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Stage 0.6A smart asset reuse smoke test passed (24 checks).");
