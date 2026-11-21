import assert from "node:assert/strict";
import fs from "node:fs";

const repositorySource = fs.readFileSync(
  new URL("../lib/persistence/media/supabaseMediaAssetRepository.ts", import.meta.url),
  "utf8",
);
const saveRouteSource = fs.readFileSync(
  new URL("../app/api/save-project/route.ts", import.meta.url),
  "utf8",
);

assert.match(
  repositorySource,
  /const PROJECT_MEDIA_URL_BATCH_SIZE = 25;/,
  "project media URL resolution must use bounded batches",
);
assert.match(
  repositorySource,
  /for \(const urlBatch of chunkProjectMediaUrls\(urls\)\)/,
  "project media lookups must iterate over URL batches",
);
assert.doesNotMatch(
  repositorySource,
  /\.in\("public_url", urls\)/,
  "project media lookup must not send the full URL set in one request",
);

const syncStart = saveRouteSource.indexOf('let mediaReferenceSync: "ok" | "deferred" = "ok";');
const responseStart = saveRouteSource.indexOf(
  "return NextResponse.json({ success: true, ...result, mediaReferenceSync });",
  syncStart,
);
assert.ok(syncStart >= 0 && responseStart > syncStart, "post-save media sync guard must exist");
const syncBlock = saveRouteSource.slice(syncStart, responseStart);
assert.match(
  syncBlock,
  /try \{[\s\S]*replaceProjectReferences\([\s\S]*\} catch \(mediaReferenceError\) \{/,
  "media reference reconciliation must be isolated from authoritative project save",
);
assert.match(
  syncBlock,
  /mediaReferenceSync = "deferred";/,
  "failed reference maintenance must be reported as deferred",
);
assert.match(
  syncBlock,
  /PROJECT_MEDIA_REFERENCE_SYNC_DEFERRED/,
  "deferred reference maintenance must remain observable",
);

console.log("creator-autosave-media-reference-resilience-test: PASS");
