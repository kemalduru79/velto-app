import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const target = path.join(
  repo,
  "lib/creator/creatorScriptBuildResearchEditorialCoordinator.ts",
);

const source = fs.readFileSync(target, "utf8");

assert.match(
  source,
  /editorial = compileEditorialResult\([\s\S]*?\} catch \{\s*const failure = stageFailure\(\{\s*category: "MODEL_CONTRACT",\s*code: "CREATOR_SCRIPT_BUILD_EDITORIAL_COMPILE_INVALID"/m,
  "compile failure must retain the existing fail-closed category and code",
);

assert.match(
  source,
  /code: "CREATOR_SCRIPT_BUILD_EDITORIAL_COMPILE_INVALID"[\s\S]*?saveFailedCheckpoint\([\s\S]*?failBuild\([\s\S]*?throw new CreatorScriptBuildCoordinatorBlockedError/m,
  "compile failure must persist its checkpoint and block the build",
);

console.log("stage-0-19e6f-editorial-compile-diagnostic-test: PASS");
