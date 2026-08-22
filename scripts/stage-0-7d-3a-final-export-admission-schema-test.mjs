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

assert.equal(hash(".env.container.example"), "7edd27a4824f955f70ec1ecaa137f69fe073efc56185f3d7a0e934b214f0643e", "production flag defaults changed");

console.log("stage-0.7d-3a final export admission schema: all checks passed");
