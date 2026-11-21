import assert from "node:assert/strict";
import fs from "node:fs";
import { parseCreatorProductionJson } from "../lib/creator/creatorProductionJson.ts";

const service = fs.readFileSync(
  new URL("../lib/creator/services/creatorProduction.server.ts", import.meta.url),
  "utf8",
);

const canonical = {
  title: "Grounded production",
  scenes: [{ id: "scene-1", narration: "A valid scene." }],
};
assert.deepEqual(parseCreatorProductionJson(JSON.stringify(canonical)), canonical);
assert.deepEqual(
  parseCreatorProductionJson(`Model output:\n\`\`\`json\n${JSON.stringify(canonical)}\n\`\`\``),
  canonical,
);
assert.deepEqual(
  parseCreatorProductionJson("{“title”:“Canonical typography”,“scenes”:[],}"),
  { title: "Canonical typography", scenes: [] },
);

for (const invalid of [
  "not json",
  '{"title":"truncated",',
  "['not', 'an', 'object']",
  "null",
]) {
  assert.throws(
    () => parseCreatorProductionJson(invalid),
    /CREATOR_PRODUCTION_MODEL_JSON_INVALID/,
  );
}

assert.match(service, /text:\s*\{\s*format:\s*\{\s*type:\s*"json_object"/);
assert.equal((service.match(/client\.responses\.create\(/g) || []).length, 1);
assert.match(service, /recordOpenAITextEconomics[\s\S]*?parseCreatorProductionJson/);
assert.match(service, /code:\s*"CREATOR_PRODUCTION_MODEL_JSON_INVALID"/);
assert.match(service, /status:\s*500/);
assert.doesNotMatch(service, /creator-production JSON parse error|repaired JSON parse error/);
assert.doesNotMatch(service, /retry|fallback.*production/i);

console.log("STAGE_0_10I_C_CREATOR_PRODUCTION_PACKAGE=PASS");
