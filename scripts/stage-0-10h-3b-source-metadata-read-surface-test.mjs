import assert from "node:assert/strict";
import fs from "node:fs";

const types = fs.readFileSync("lib/persistence/media/types.ts", "utf8");
const repository = fs.readFileSync("lib/persistence/media/supabaseMediaAssetRepository.ts", "utf8");

assert.match(types, /metadata\?: Record<string, unknown>;/);
assert.match(repository, /metadata\?: unknown;/);
assert.match(
  repository,
  /BASE_ASSET_FIELDS:[^\n]*metadata/,
  "Stored media reads must select existing metadata without a new persistence store.",
);
assert.match(repository, /function assetMetadata\(value: unknown\)/);
assert.match(repository, /metadata: assetMetadata\(row\.metadata\)/);
assert.match(repository, /metadata: input\.metadata \|\| \{\}/);
assert.doesNotMatch(repository, /source_media_assets|rights_passport|rights_store/i);

console.log("Stage 0.10H-3B source metadata read surface tests passed.");
