import fs from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const read = (file) => fs.readFileSync(file, "utf8");
const helperSource = read("lib/creator/projectAssets.ts");
const component = read("components/create/CreatorProjectAssets.tsx");
let reuseImplementationUnchanged = true;
try {
  execFileSync("git", ["diff", "--quiet", "HEAD", "--", "lib/creator/projectAssets.ts"]);
} catch {
  reuseImplementationUnchanged = false;
}
const transpiled = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helper = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`);

const scenes = [
  { id: 1, creatorSceneId: "target", text: "Astronaut explores a mysterious lunar research station", image: "target.jpg" },
  { id: 2, creatorSceneId: "strong", text: "Astronaut enters the lunar station laboratory", image: "strong.jpg", videoUrl: "strong.mp4", videoStatus: "done" },
  { id: 3, creatorSceneId: "weak", text: "A chef prepares vegetables in a bright kitchen", image: "weak.jpg" },
  { id: 4, creatorSceneId: "history", text: "Lunar research team studies a station map", assetHistory: [{ id: "h", kind: "image", url: "history.jpg", createdAt: "2026-01-01" }] },
  { id: 5, creatorSceneId: "extra", narration: "Research station crew observes lunar terrain", image: "extra.jpg" },
  { id: 6, creatorSceneId: "fourth", text: "Astronaut research near the lunar station", image: "fourth.jpg" },
];
const rank = (inputScenes = scenes, maxResults) => helper.rankCreatorProjectAssetsForScene({
  scenes: inputScenes,
  targetCreatorSceneId: "target",
  ...(maxResults === undefined ? {} : { maxResults }),
});
const ranked = rank();

check(ranked.some((asset) => asset.url === "strong.jpg") && !ranked.some((asset) => asset.url === "weak.jpg"), "strong shared topic ranks above unrelated asset");
check(!ranked.some((asset) => asset.url === "target.jpg"), "target current image is excluded");
check(!ranked.some((asset) => asset.kind === "video" || asset.url.endsWith(".mp4")), "cross-scene video is not recommended");
check(helper.rankCreatorProjectAssetsForScene({ scenes: [scenes[0], scenes[2]], targetCreatorSceneId: "target" }).length === 0, "no meaningful overlap returns no recommendations");
check(JSON.stringify(rank()) === JSON.stringify(rank()), "ranking is deterministic");
const versionPreferenceScenes = [
  { id: 1, creatorSceneId: "target", text: "Ocean coral reef expedition", image: "target.jpg" },
  { id: 2, creatorSceneId: "current", text: "Coral portrait", image: "current.jpg" },
  { id: 3, creatorSceneId: "history", text: "Ocean coral reef", assetHistory: [{ id: "history", kind: "image", url: "history.jpg" }] },
];
const versionPreferenceRanked = helper.rankCreatorProjectAssetsForScene({ scenes: versionPreferenceScenes, targetCreatorSceneId: "target" });
check(versionPreferenceRanked[0]?.url === "history.jpg", "topical historical asset beats less-relevant current asset");
check(!rank([...scenes, { id: 99, creatorSceneId: "outside", text: "unrelated", image: "outside.jpg" }]).some((asset) => asset.url === "outside.jpg"), "only eligible assets derived from supplied project scenes can match");
check(rank(scenes, 2).length === 2 && rank(scenes, 99).length <= 3, "maximum recommendation count is enforced");
check(ranked.some((asset) => asset.url === "strong.jpg"), "English token overlap works");
const turkish = [
  { id: 1, creatorSceneId: "target", text: "Astronot ay üssünde gizemli araştırma yapıyor", image: "tr-target.jpg" },
  { id: 2, creatorSceneId: "match", narration: "Ay üssünde astronot araştırma ekibini buluyor", image: "tr-match.jpg" },
  { id: 3, creatorSceneId: "other", text: "Mutfakta sıcak ekmek pişiyor", image: "tr-other.jpg" },
];
check(helper.rankCreatorProjectAssetsForScene({ scenes: turkish, targetCreatorSceneId: "target" })[0]?.url === "tr-match.jpg", "Turkish token overlap works");
const turkishStopWordsOnly = [
  { id: 1, creatorSceneId: "target", text: "Bu sahne için çok önemli olan bir an", image: "stop-target.jpg" },
  { id: 2, creatorSceneId: "candidate", text: "Bu proje için çok farklı olan başka bir konu", image: "stop-candidate.jpg" },
];
check(helper.rankCreatorProjectAssetsForScene({ scenes: turkishStopWordsOnly, targetCreatorSceneId: "target" }).length === 0, "normalized Turkish stop-word-only overlap does not recommend");
check(["bu", "icin", "cok", "olan", "bir"].every((token) => !helper.tokenizeCreatorMatchText(turkishStopWordsOnly[0].text).includes(token)), "Turkish stop words use content normalization representation");
const turkishRealTopic = [
  { id: 1, creatorSceneId: "target", text: "Bas gitar funk müziğinin ritmini değiştiriyor", image: "topic-target.jpg" },
  { id: 2, creatorSceneId: "candidate", text: "Funk müziğinde bas gitar ve ritim öne çıkıyor", image: "topic-candidate.jpg" },
];
check(helper.rankCreatorProjectAssetsForScene({ scenes: turkishRealTopic, targetCreatorSceneId: "target" })[0]?.url === "topic-candidate.jpg", "real Turkish topic overlap still recommends");
check(/topicalScore < 2/.test(helperSource), "matching threshold remains unchanged");
check(JSON.stringify(rank()) === JSON.stringify(rank()), "ranking remains deterministic after stop-word normalization");
check(!/fetch\(|XMLHttpRequest|WebSocket|Worker\(/.test(helperSource), "matcher requires no network, API, or worker");
check(reuseImplementationUnchanged, "existing 0.6A ranking/reuse helper remains unchanged");
check(/rankCreatorProjectAssetsForScene/.test(component) && /onUseImage\(asset\.url, asset\.sourceCreatorSceneId\)/.test(component), "recommended image uses the existing 0.6A callback");
check(!/creator-image|creator-video|generate-image|generate-video/i.test(component), "recommendation and reuse UI trigger no generation API");
check(!/storyverse/i.test(helperSource + component), "Storyverse remains unchanged");

if (failures.length) {
  console.error(`Stage 0.6B Local Smart Match failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Stage 0.6B Local Smart Match passed (20 checks).");
