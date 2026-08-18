import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const baselineMigration = "supabase/migrations/20260818220000_stage_0_7d_2_storage_entitlements_admissions.sql";
const migrationFile = "supabase/migrations/20260818230000_stage_0_7d_3_add_final_movie_export_admission_purpose.sql";
const migration = read(migrationFile);
const admission = read("lib/persistence/media/storageAdmission.server.ts");

assert.equal(hash(baselineMigration), "be095e5692a331d37df93a648f87dbe729877edeb44dc604bff2f5fa0adf95ec", "0.7D-2 migration changed");
assert.match(migration, /alter table public\.velto_storage_admissions\s+drop constraint velto_storage_admissions_purpose_check;/);
assert.match(migration, /alter table public\.velto_storage_admissions\s+add constraint velto_storage_admissions_purpose_check/);
for (const purpose of [
  "creator_generated_image",
  "storyverse_generated_image",
  "storyverse_generated_video",
  "final_movie_export",
]) assert.match(migration, new RegExp(`'${purpose}'`));
assert.doesNotMatch(migration, /'(?:export|generated_media|creator_video|other)'/);
assert.doesNotMatch(migration, /media_kind|row level security|\bgrant\b|\brevoke\b|\bupdate\b|\binsert\b|\bdelete\b/i);
assert.match(admission, /StorageAdmissionPurpose[\s\S]*\| "final_movie_export";/);

const unchangedFiles = {
  "app/api/creator-export/route.ts": "bb69da1e295f5ab39229a84f433f056a0c4e727d9632a52b90063f75ccc7a1be",
  "app/api/export-movie/route.ts": "51cd6b2a1b861b8b80063e89be31a1e709502c137732731e1009231d7ba74c0c",
  "export-service/src/server.js": "20b46c3866d7b34cad88a3b76ef91cf17980eb53551dddb96a4298d91d6e2ed3",
  ".env.container.example": "e709c91a31f7c5b10191ff818796aea71b13c437e816bc5a3cd7973eeff764f3",
};
for (const [file, expected] of Object.entries(unchangedFiles)) assert.equal(hash(file), expected, `${file} changed`);

console.log("stage-0.7d-3a final export admission schema: all checks passed");
