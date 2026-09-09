import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const doc = read("docs/STAGE-0.11E-AZURE-READINESS-GATE.md");
const critical = read("scripts/stage-0-8a-critical-regression.mjs");
const docker = read("Dockerfile");
const exportDocker = read("export-service/Dockerfile");
const nextConfig = read("next.config.ts");
const worker = read("lib/worker/runtime.mjs");
const persistence = read("lib/persistence/factory.ts");
const observability = read("lib/observability/exporters.ts");
const packageJson = JSON.parse(read("package.json"));

assert.match(doc, /\*\*0\.12 DEFERRED\.\*\*/);
assert.match(doc, /Current Azure trigger: \*\*NO\*\*/);
assert.match(doc, /Azure plan\/spend required now: \*\*NO\*\*/);
assert.match(doc, /Vercel \+ Supabase \+ Railway/);
assert.match(doc, /Azure runtime \+ existing Supabase DB\/Auth\/Storage/);
assert.match(doc, /no measured capacity, cost, security\/compliance, revenue\/beta, or operational trigger/i);
assert.match(doc, /Microsoft for Startups is not assumed/);
assert.match(doc, /Rollback is disabling the staging route\/revision/);

assert.match(nextConfig, /output:\s*"standalone"/);
assert.match(docker, /USER nextjs/);
assert.match(docker, /\/api\/runtime-health\?mode=live/);
assert.match(docker, /STOPSIGNAL SIGTERM/);
assert.match(exportDocker, /USER node/);
assert.match(exportDocker, /\/health/);
assert.match(worker, /SIGTERM/);
assert.match(worker, /no new jobs will be claimed/);
assert.match(persistence, /provider selection is centralized here/);
assert.match(observability, /interface ObservabilityExporter/);

const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
assert.equal(Object.keys(dependencies).some((name) => name.startsWith("@azure/")), false);
const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split("\n");
assert.equal(tracked.some((path) => /(?:\.tf|\.tfvars|\.bicep)$|(?:azuredeploy|mainTemplate)\.json$/i.test(path)), false);
assert.equal((critical.match(/scripts\/stage-0-11e-azure-readiness-gate-test\.mjs/g) || []).length, 1);

const changed = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trimEnd().split("\n").filter(Boolean).map((line) => line.slice(3).split(" -> ").at(-1));
const allowed = new Set([
  "docs/STAGE-0.11E-AZURE-READINESS-GATE.md",
  "scripts/stage-0-11e-azure-readiness-gate-test.mjs",
  "scripts/stage-0-8a-critical-regression.mjs",
  "scripts/stage-0-8g-architecture-closure-test.mjs",
  "scripts/stage-0-10i-b-visual-system-test.mjs",
  "scripts/stage-0-10i-f-visual-consolidation-test.mjs",
  "app/api/character-image/route.ts",
  "app/api/creator-export/route.ts",
  "app/api/creator-video/route.ts",
  "app/api/image/route.ts",
  "app/api/store-audio/route.ts",
  "app/api/store-dialogue-audio/route.ts",
  "app/create/page.tsx",
  "components/auth/UserAccountMenu.tsx",
  "lib/credits/creatorAccountingAdmission.ts",
  "lib/credits/serverMetering.ts",
  "lib/economics/repository.ts",
  "scripts/beta-data-p1b-1-smoke-test.mjs",
  "scripts/beta-fin-p1-character-reference-cost-guard-smoke-test.mjs",
  "scripts/stage-0-11e-creatorlab-zero-credit-gating-test.mjs",
  "docs/STAGE-0.11F-CLOSURE-GO-NO-GO.md",
  "scripts/stage-0-11f-closure-go-no-go-test.mjs",
  "scripts/stage-0-9a-security-consent-baseline-test.mjs",
  "app/api/save-project/route.ts",
  "lib/persistence/projects/supabaseProjectRepository.ts",
  "lib/persistence/projects/types.ts",
  "package.json",
  "lib/creator/projectState.ts",
  "lib/creator/projectSaveCoordinator.ts",
  "lib/persistence/projects/projectPatch.ts",
  "scripts/stage-0-13a-creator-project-state-persistence-test.mjs",
  "scripts/beta-project-p1-refresh-restoration-smoke-test.mjs",
  "scripts/stage-0-10h-manual-project-save-test.mjs",
  "scripts/stage-0-10h-strategy-backward-navigation-persistence-test.mjs",
  "app/api/creator-script-plan/route.ts",
  "components/create/CreatorScriptReview.tsx",
  "lib/creator/creatorScript.ts",
  "lib/creator/creatorProductionAuthority.ts",
  "lib/creator/services/creatorProduction.server.ts",
  "lib/research/creatorEditorialPipeline.client.ts",
  "lib/research/scriptPlannerEditorialContext.ts",
  "scripts/stage-0-10h-2i-creator-editorial-orchestration-test.mjs",
  "scripts/stage-0-10h-4i-creator-pi-documentary-wiring-test.mjs",
  "scripts/stage-0-10h-4j-documentary-pi-closure-test.mjs",
  "scripts/stage-0-10h-market-evidence-strategy-ux-test.mjs",
  "scripts/stage-0-10i-c-stage-polish-test.mjs",
  "scripts/stage-0-13b-full-script-review-test.mjs",
  "app/api/creator-editorial-analysis/route.ts",
  "app/creatorlab-ux-h0a.css",
  "lib/creator/stageNavigation.ts",
  "lib/research/editorialGroundingRepair.ts",
  "scripts/stage-0-10h-ui-acceptance-editorial-grounding-repair-test.mjs",
  "scripts/post-0-13b-duplicate-evidence-hotfix-test.mjs",
  "scripts/post-0-13b-five-stage-workflow-hotfix-test.mjs",
  "lib/creator/audioTimeline.ts",
  "scripts/stage-0-13c-a-audio-timeline-test.mjs",
  "lib/creator/finalProductionSignature.ts",
  "scripts/stage-0-13c-b-audio-timeline-persistence-test.mjs",
  "next.config.ts",
  "app/api/creator-audio-assets/",
  "lib/creator/audioAssetResolver.server.ts",
  "lib/creator/audioAssets.ts",
  "lib/creator/audioProbe.server.ts",
  "scripts/stage-0-13c-c-secure-audio-assets-test.mjs",
  "scripts/stage-0-8f-b-recovery-operator-test.mjs",
]);
assert.deepEqual(changed.filter((path) => !allowed.has(path)), []);

console.log("STAGE_0_11E_AZURE_READINESS_GATE=PASS");
