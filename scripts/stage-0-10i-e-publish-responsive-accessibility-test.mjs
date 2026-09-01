import assert from "node:assert/strict";
import fs from "node:fs";

import { createCreatorPublishPreflight } from "../lib/creator/publishPreflight.ts";

const page = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const tokens = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const baseline = fs.readFileSync(new URL("../app/creatorlab-ux-i-b.css", import.meta.url), "utf8");
const polish = fs.readFileSync(new URL("../app/creatorlab-ux-i-e.css", import.meta.url), "utf8");
const critical = fs.readFileSync(new URL("./stage-0-8a-critical-regression.mjs", import.meta.url), "utf8");

assert.match(
  layout,
  /import "\.\/creatorlab-ux-i-d\.css";\s*import "\.\/creatorlab-ux-i-e\.css";/,
  "I-E must load after the closed I-D presentation layer",
);

const preflight = createCreatorPublishPreflight({
  contentReady: true,
  visualsReady: false,
  voiceReady: false,
  evidenceVerified: false,
  rightsConfirmed: false,
  outputReady: false,
});
assert.deepEqual(
  preflight.map((item) => item.category),
  ["content", "visuals", "voice", "evidence", "rights", "output"],
  "Publish retains exactly the six canonical preflight categories",
);
assert.deepEqual(
  preflight.map((item) => item.status),
  ["ready", "action_required", "action_required", "review", "review", "blocked"],
  "I-E does not change canonical readiness semantics",
);

const publishStart = page.indexOf('id="creatorlab-publish-canvas"');
const publishEnd = page.indexOf("{!isCreatorLabFlow", publishStart);
const publish = page.slice(publishStart, publishEnd);
assert.ok(publishStart > -1 && publishEnd > publishStart, "Publish workspace remains present");

for (const contract of [
  /data-creator-publish-preflight/,
  /creatorPublishPreflight\.map/,
  /System checks/,
  /Creator confirmations/,
  /creatorlab-publish-video/,
  /Final video/,
  /creatorlab-publish-thumbnail/,
  /Thumbnail/,
  /Publishing copy/,
  /Channel-specific publishing copy/,
  /Creator Package contents/,
  /Approve & Export Creator Package/,
]) assert.match(publish, contract);
assert.match(page, /evidence:\s*uiLanguage === "en" \? "Evidence"/);
assert.match(page, /rights:\s*uiLanguage === "en" \? "Rights"/);

assert.match(
  publish,
  /onClick=\{handleDownloadCreatorPackage\}[\s\S]*?disabled=\{isDownloadingCreatorPackage \|\| !creatorPackageReady\}/,
  "the authoritative export handler and gate remain unchanged",
);
assert.equal((publish.match(/className="creatorlab-publish-primary-action"/g) || []).length, 1);

// Canonical I-B accessibility and token foundations remain authoritative.
assert.match(baseline, /:where\(button, a, input, textarea, select, summary\):focus-visible/);
assert.match(tokens, /--cl-type-meta:\s*12px/);
assert.doesNotMatch(polish, /:root|--cl-[\w-]+\s*:/, "I-E defines no parallel token source");
assert.doesNotMatch(polish, /#[0-9a-f]{3,8}\b/i, "I-E adds no decorative color palette");
assert.doesNotMatch(polish, /(?:youtube|instagram|tiktok|facebook|linkedin)[\s\S]{0,80}(?:color|background)/i);
assert.match(polish, /\[data-preflight-status="ready"\][\s\S]*?var\(--cl-success\)/);
assert.match(polish, /data-preflight-status="action_required"[\s\S]*?var\(--cl-warning\)/);
assert.match(polish, /\[data-preflight-status="blocked"\][\s\S]*?var\(--cl-danger\)/);
assert.match(polish, /font-size:\s*var\(--cl-type-meta\)/);
assert.match(polish, /@media \(max-width: 1180px\)/);
assert.match(polish, /@media \(max-width: 1023px\)/);
assert.match(polish, /@media \(max-width: 720px\)/);
assert.match(polish, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(polish, /env\(safe-area-inset-bottom\)/);
assert.match(polish, /creatorlab-copilot-launcher\.is-publish-context/);
assert.match(polish, /@media \(forced-colors: active\)/);
assert.match(polish, /@media \(prefers-reduced-motion: reduce\)/);
assert.doesNotMatch(polish, /storyverse/i, "I-E remains CreatorLab-scoped");
assert.doesNotMatch(polish, /fetch\(|\/api\/|localStorage|supabase|credits?|economics/i);

assert.equal(
  (critical.match(/scripts\/stage-0-10i-e-publish-responsive-accessibility-test\.mjs/g) || []).length,
  1,
  "I-E is registered exactly once in the critical suite",
);

console.log("STAGE_0_10I_E_PUBLISH_RESPONSIVE_ACCESSIBILITY=PASS");
