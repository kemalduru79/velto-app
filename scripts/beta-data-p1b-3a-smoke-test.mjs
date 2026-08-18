import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const read = (file) => fs.readFileSync(file, "utf8");
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const publicRoute = read("app/api/public-project/[shareId]/route.ts");
const shareRoute = read("app/api/share-project/route.ts");
const repository = read("lib/persistence/projects/supabaseProjectRepository.ts");
const types = read("lib/persistence/projects/types.ts");
const mapperSource = read("lib/security/publicStoryverseProjection.ts");

const validationIndex = publicRoute.indexOf("/^[0-9a-fA-F]{16}$/");
const repositoryIndex = publicRoute.indexOf("getPublicByShareId");
assert.ok(validationIndex >= 0 && validationIndex < repositoryIndex, "share ID validation must precede persistence access");
assert.ok(publicRoute.includes("shareId.toLowerCase()"));
assert.ok(publicRoute.includes("mapPublicStoryverseEpisode(source)"));
assert.ok(publicRoute.includes('"Cache-Control": "no-store, max-age=0"'));
assert.doesNotMatch(publicRoute, /success:\s*true,\s*(?:source|raw|record)/);

const publicFields = repository.match(/const PUBLIC_PROJECT_FIELDS\s*=\s*\n?\s*"([^"]+)"/)?.[1]
  .split(",")
  .map((value) => value.trim());
assert.deepEqual(publicFields, [
  "title", "story_premise", "language", "flow_type", "characters", "scenes",
  "published_at", "exported_movie_url",
]);
assert.match(repository, /\.eq\("share_id", shareId\)[\s\S]*?\.eq\("is_public", true\)/);
assert.match(repository, /select\("id, owner_user_id, share_id, flow_type"\)/);
const ownerComparison = repository.indexOf("existingProject.owner_user_id !== ownerUserId");
const flowComparison = repository.indexOf('existingProject.flow_type !== "storyverse"');
const publishUpdate = repository.indexOf("is_public: true");
assert.ok(ownerComparison >= 0 && ownerComparison < flowComparison && flowComparison < publishUpdate);
assert.ok(types.includes('{ status: "unsupported_flow" }'));
assert.ok(shareRoute.includes('result.status === "unsupported_flow"'));
assert.ok(shareRoute.includes("{ status: 409 }"));

for (const forbidden of ["...source", "...project", "...character", "...scene"]) {
  assert.ok(!mapperSource.includes(forbidden), `mapper contains forbidden spread: ${forbidden}`);
}
assert.doesNotMatch(mapperSource, /return\s+(?:source|project)\s*;/);
assert.equal(hash("package-lock.json"), "c806716b77f5d95279a65f7fdd62fdfaed454e3042989caa68f2fc09d0f287db");
assert.equal(JSON.parse(read("package.json")).scripts["test:beta-data-p1b-3a"], "node scripts/beta-data-p1b-3a-smoke-test.mjs");

const protectedHashes = {
  "app/episode/public/[shareId]/page.tsx": "8571a245416e5b5b9f9f65197a988788c634b631941a3da817f29a2172630b55",
  "app/episode/[projectId]/page.tsx": "5bdfd767400592e91bb09c7773935dd666f467cd0febf72d9be7d578ca273cf9",
  "app/api/load-project/[projectId]/route.ts": "2813a36706fb8de65d3e72795c070434b166a7fe044f4e04ab49572fe967dd58",
  "app/api/save-project/route.ts": "3657da0da57fd5db56a5a783ea0729f47f01a6df1d0df897ea0413e4bd03d348",
  "app/api/projects/route.ts": "191fb4473a5316932cf6fb7c82b5ef8e3ba35a0053b4e674d49eb2bf55eb0f20",
  "app/api/jobs/route.ts": "848f262b3472e9a4bb83768b84daacb75f6302d9ebd04eaf5fd6c05eea924522",
  "lib/security/legacyMediaStorageBoundary.ts": "5647c6c5da4b9179a2b7ee6533d0f6d65f59aa646bf42273019dc433fc4d3cdd",
  "supabase/migrations/20260728090000_foundation_p1_auth_credit_ledger.sql": "459cb55c26e55c60ce28435bb9bad4b3f7da35e1b1464daf600d08742f0fefc9",
  "supabase/migrations/20260730110000_cancel_p1_job_cancellation.sql": "8f37b245577cdaec57049d2fd1db73ce5010a5079596d819b08e763943feb55f",
  "supabase/migrations/20260730120000_fin_p1c_credit_reconciliation.sql": "50862a6f4150d28a9d456dbc675c78980eef3b2f8747039a87b562a67c8b7dff",
  "supabase/migrations/20260730100000_scale_p1_job_queue.sql": "99ef660fb49f40a06d19a753a38110db086dc64eca5f206c15b9021be9e8dac3",
  "supabase/migrations/20260731090000_scale_p1_worker_hardening.sql": "ee6ddff9756d1bc0ac7fcda86155078dc5c41aa354526ab37eb45ccfff230e73",
};
for (const [file, expected] of Object.entries(protectedHashes)) {
  assert.equal(hash(file), expected, `${file} changed`);
}

for (const marker of [
  '.select(PROJECT_LIST_FIELDS)', '.eq("owner_user_id", ownerUserId)',
  '.select("*")', '.eq("id", projectId)', '.update(payload)', '.insert([payload])',
]) assert.ok(repository.includes(marker), `private repository behavior lost: ${marker}`);

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "velto-public-projection-"));
try {
  execFileSync(path.resolve("node_modules/.bin/tsc"), [
    "lib/security/publicStoryverseProjection.ts", "--outDir", temporaryDirectory,
    "--module", "commonjs", "--target", "ES2022", "--skipLibCheck",
  ], { stdio: "pipe" });
  const require = createRequire(import.meta.url);
  const compiled = require(path.join(temporaryDirectory, "publicStoryverseProjection.js"));
  const { mapPublicStoryverseEpisode, PUBLIC_STORYVERSE_LIMITS } = compiled;

  const forbiddenProject = {
    id: "private-project", owner_user_id: "user", child_id: "child", input_prompt: "secret",
    visual_bible: { internal: true }, share_id: "0123456789abcdef", is_public: true,
    created_at: "private", updated_at: "private", exported_movie_result: { secret: true },
    export_signature: "secret", creator_mentor_result: { secret: true },
    creator_production_package: { secret: true }, title: "Public title", language: "tr",
    flow_type: "storyverse", story_premise: "Public premise", published_at: "2026-08-06T00:00:00.000Z",
    exported_movie_url: "https://cdn.example.com/movie.mp4",
    characters: [{
      name: "Ada", age: "10", personality: "Brave", outfit: "Blue", referenceImage: "/media/ada.png",
      appearance: "private", accessory: "private", voiceId: "private", voiceProfileId: "private",
      voiceSelection: { secret: true }, provider: "private", nativeTaskId: "private",
      privateNotes: "private", arbitraryUnknownKey: "private",
    }],
    scenes: [1, 2].map((id) => ({
      id, text: `Text ${id}`, narration: `Narration ${id}`, dialogue: `Dialogue ${id}`,
      emotion: "joy", cameraDirection: "wide", motionHint: "slow", image: `/media/${id}.png`,
      videoUrl: `https://cdn.example.com/${id}.mp4`, visualPrompt: "private", renderMode: "video",
      videoStatus: "done", videoJobId: "private", videoQueueJobId: "private", audioPath: "/private/audio",
      dialogueAudioPath: "/private/dialogue", narratorVoiceProfileId: "private",
      narratorVoiceSelection: { secret: true }, dialogueVoiceSelections: { secret: true },
      timing: { secret: true }, intelligence: { secret: true }, scriptHealth: { secret: true },
      visualBlockPlan: [{ secret: true }], assetHistory: [{ secret: true }], provider: "private",
      nativeTaskId: "private", reservationId: "private", traceId: "private", arbitraryUnknownKey: "private",
    })),
  };
  const sourceSnapshot = structuredClone(forbiddenProject);
  const dto = mapPublicStoryverseEpisode(forbiddenProject);
  assert.ok(dto);
  assert.equal(dto.title, "Public title");
  assert.equal(dto.language, "tr");
  assert.equal(dto.story_premise, "Public premise");
  assert.equal(dto.published_at, "2026-08-06T00:00:00.000Z");
  assert.equal(dto.exported_movie_url, "https://cdn.example.com/movie.mp4");
  assert.deepEqual(dto.characters.map((item) => item.name), ["Ada"]);
  assert.deepEqual(dto.scenes.map((item) => item.id), [1, 2]);
  const serialized = JSON.stringify(dto);
  for (const key of [
    "id\":\"private-project", "owner_user_id", "child_id", "input_prompt", "visual_bible", "share_id",
    "is_public", "created_at", "updated_at", "exported_movie_result", "export_signature",
    "creator_mentor_result", "creator_production_package", "appearance", "accessory", "voiceId",
    "voiceProfileId", "voiceSelection", "provider", "nativeTaskId", "privateNotes", "arbitraryUnknownKey",
    "visualPrompt", "renderMode", "videoStatus", "videoJobId", "videoQueueJobId", "audioPath",
    "dialogueAudioPath", "narratorVoiceProfileId", "narratorVoiceSelection", "dialogueVoiceSelections",
    "timing", "intelligence", "scriptHealth", "visualBlockPlan", "assetHistory", "reservationId", "traceId",
  ]) assert.ok(!serialized.includes(key), `forbidden key/value leaked: ${key}`);
  assert.deepEqual(forbiddenProject, sourceSnapshot, "source fixture was mutated");
  assert.notEqual(dto.characters[0], forbiddenProject.characters[0]);
  assert.notEqual(dto.scenes[0], forbiddenProject.scenes[0]);

  assert.deepEqual(mapPublicStoryverseEpisode({
    title: "Minimal", language: "en", flow_type: "storyverse", characters: null, scenes: "invalid",
    story_premise: null, published_at: null, exported_movie_url: null,
  }), { title: "Minimal", language: "en", characters: [], scenes: [] });
  assert.equal(mapPublicStoryverseEpisode({ ...forbiddenProject, flow_type: "creator_lab" }), null);
  assert.equal(mapPublicStoryverseEpisode({ ...forbiddenProject, flow_type: null }), null);

  const unsafeUrls = ["javascript:alert(1)", "data:image/png;base64,AA", "blob:https://example.com/id", "file:///tmp/a", "//example.com/a", "https://user:pass@example.com/a", "not a url"];
  for (const unsafe of unsafeUrls) {
    const unsafeDto = mapPublicStoryverseEpisode({
      ...forbiddenProject, exported_movie_url: unsafe,
      characters: [{ name: "A", referenceImage: unsafe }], scenes: [{ id: 1, image: unsafe, videoUrl: unsafe }],
    });
    assert.ok(unsafeDto && !("exported_movie_url" in unsafeDto));
    assert.ok(!("referenceImage" in unsafeDto.characters[0]));
    assert.ok(!("image" in unsafeDto.scenes[0]) && !("videoUrl" in unsafeDto.scenes[0]));
  }
  assert.equal(mapPublicStoryverseEpisode({ ...forbiddenProject, characters: Array.from({ length: 150 }, (_, index) => ({ name: String(index) })) }).characters.length, PUBLIC_STORYVERSE_LIMITS.maxCharacterCount);
  assert.equal(mapPublicStoryverseEpisode({ ...forbiddenProject, scenes: Array.from({ length: 600 }, (_, index) => ({ id: index })) }).scenes.length, PUBLIC_STORYVERSE_LIMITS.maxSceneCount);
  assert.equal(mapPublicStoryverseEpisode({
    ...forbiddenProject,
    scenes: Array.from({ length: 100 }, (_, index) => ({ id: index, text: "x".repeat(50_000) })),
  }), null, "excessive serialized output must fail closed");
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

console.log("BETA-DATA-P1B-3A public projection smoke test passed.");
