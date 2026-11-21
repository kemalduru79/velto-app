import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const target = path.join(
  repo,
  "lib/creator/creatorScriptBuildProviderContract.ts",
);

const source = fs.readFileSync(target, "utf8");

assert.match(
  source,
  /catch \(error\) \{\s*if \(error instanceof CreatorScriptBuildStageExecutionError\) throw error;\s*throw modelContractFailure\(\s*"CREATOR_SCRIPT_BUILD_CLAIM_ORIGIN_ADJUDICATION_INVALID"/m,
  "claim-origin reconciliation must preserve typed errors and the public fail-closed code",
);

assert.match(
  source,
  /export function createCreatorScriptBuildAdjudicationRejectionDiagnostic\(/m,
  "durable adjudication rejection diagnostics must remain available",
);

console.log("stage-0-19e6h-claim-origin-diagnostic-test: PASS");
