import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const start = page.indexOf('data-creator-scene-video-preview="contain"');
const preview = page.slice(Math.max(0, start - 240), start + 520);
let checks = 0;
const check = (value, label) => {
  assert.ok(value, label);
  checks += 1;
};

check(start >= 0, "CreatorLab primary scene video preview is explicitly identified");
check(/sceneOutputMode === "video"/.test(preview), "preview remains selected video mode only");
check(/src=\{scene\.videoUrl\}/.test(preview), "preview uses the canonical selected scene video");
check(/object-contain/.test(preview), "preview contains the full video frame");
check(!/object-cover/.test(preview), "preview does not crop media to fill its shell");
check(/aspect-video/.test(preview) && /bg-slate-950/.test(preview), "fixed professional shell provides letterbox or pillarbox space");
check(/controls/.test(preview), "native video controls remain enabled");
check(/playsInline/.test(preview), "inline and native fullscreen behavior remain available");
check(/scene\.image[\s\S]*object-contain/.test(page.slice(start, start + 900)), "image mode remains contain-safe");
check(/sceneOutputMode === "video"[\s\S]*:\s*scene\.image/.test(page.slice(start - 260, start + 900)), "image/video switching remains conditional and local");
check(!/fetch\(|credit|reserve|provider/i.test(preview), "preview rendering performs no generation, provider, or credit work");
check(!/productProfile.*storyverse/i.test(preview), "Storyverse behavior is outside the CreatorLab preview change");

console.log(`CreatorLab scene video contain preview smoke passed (${checks}/${checks}).`);
