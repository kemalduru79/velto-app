import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const trackedInventoryHash = (pathspec) => {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", pathspec], { encoding: "utf8" });
  return createHash("sha256").update(files).digest("hex");
};
const check = (name, assertion) => {
  assertion();
  console.log(`PASS ${name}`);
};

const status = read("docs/STAGE-0.8-STATUS.md");
const closure = read("docs/STAGE-0.8-ARCHITECTURE-CLOSURE.md");
const workflow = read(".github/workflows/ci.yml");
const dockerfile = read("Dockerfile");
const exportDockerfile = read("export-service/Dockerfile");
const compose = read("compose.yaml");
const packageJson = JSON.parse(read("package.json"));

for (const stage of ["A", "B", "C", "D", "E", "F"]) {
  check(`0.8${stage} is closed`, () => assert.match(status, new RegExp(`0\\.8${stage}: CLOSED/PASS`)));
}
check("0.8F-A is closed", () => assert.match(status, /0\.8F-A[^\n]*CLOSED\/PASS/));
check("0.8F-B is closed", () => assert.match(status, /0\.8F-B[^\n]*CLOSED\/PASS/));
check("0.8G is closed", () => assert.match(status, /0\.8G[^\n]*CLOSED\/PASS/));
check("overall Stage 0.8 closure is recorded", () => assert.match(status, /Stage 0\.8 is globally CLOSED\/PASS/));

for (const heading of [
  "Objective", "Final runtime topology", "Architectural style", "Persistence",
  "Runtime configuration and secrets", "Optional provider boundary", "CI and quality gates",
  "Runtime safety", "Observability and recovery", "Cloud portability",
  "Deferred work and non-goals", "Closure decision",
]) {
  check(`closure documents ${heading}`, () => assert.match(closure, new RegExp(`## ${heading}`)));
}
check("web, worker, and export topology is explicit", () => {
  assert.match(closure, /### Web/);
  assert.match(closure, /### Worker/);
  assert.match(closure, /### Export/);
});
check("Node 22 and runtime ports are documented", () => {
  assert.match(closure, /Node\.js 22/);
  assert.match(closure, /port 3000/);
  assert.match(closure, /port 3001/);
});
check("stateless and temporary filesystem contracts are documented", () => {
  assert.match(closure, /stateless Next\.js web runtime/);
  assert.match(closure, /\/tmp` as the only writable temporary area/);
  assert.match(closure, /no durable state relies on a local container filesystem/);
});
check("Supabase persistence contract is documented", () => {
  assert.match(closure, /Supabase Postgres, Supabase Auth, and Supabase Storage/);
  assert.match(closure, /current implemented persistence driver remains Supabase/);
});
check("canonical release identity is documented", () => assert.match(closure, /`VELTO_RELEASE` is the canonical cloud-neutral release identity/));
check("health and recovery contracts are documented", () => {
  assert.match(closure, /live and ready health endpoints/);
  assert.match(closure, /safe operator runbook/);
  assert.match(closure, /preview-before-apply/);
  assert.match(closure, /purge recovery procedures fail closed/);
});
check("architecture remains a modular monolith", () => assert.match(closure, /MODULAR MONOLITH/));
check("architecture rejects a microservices claim", () => assert.match(closure, /not a microservices architecture/i));
check("current production target is retained", () => assert.match(closure, /Vercel \+ Supabase \+ Railway/));
check("Azure remains deferred at zero cost", () => {
  assert.match(closure, /no Azure resources/);
  assert.match(closure, /Azure cost at €0/);
});
for (const stage of ["0.9", "0.10", "0.11", "0.12"]) {
  check(`${stage} is explicitly deferred`, () => assert.match(closure, new RegExp(`Stage ${stage.replace(".", "\\.")}`)));
}
check("closure evidence records committed CI and Vercel", () => {
  assert.match(closure, /Stage 0\.8 is \*\*CLOSED \/ PASS\*\*/);
  assert.match(closure, /2dd3548f7fe3fa0084cc27d045412cb6563775bf/);
  assert.match(closure, /32522776885/);
  assert.match(closure, /Vercel validation on the same SHA/);
  assert.match(closure, /no unresolved P0\/P1 architecture blocker remained/);
});

check("CI uses Node 22", () => assert.match(workflow, /node-version:\s*["']?22/));
check("CI runs locked installation", () => assert.match(workflow, /run:\s*npm ci/));
check("CI has read-only contents permission", () => assert.match(workflow, /contents:\s*read/));
check("web and worker images use Node 22", () => assert.match(dockerfile, /FROM node:22-/));
check("worker image is non-root", () => assert.match(dockerfile, /FROM deps AS worker[\s\S]*?USER node/));
check("web runner image is non-root", () => assert.match(dockerfile, /USER nextjs/));
check("export image uses Node 22", () => assert.match(exportDockerfile, /FROM node:22-/));
check("export image is non-root", () => assert.match(exportDockerfile, /USER node/));
check("portable services use read-only filesystems", () => assert.equal((compose.match(/read_only:\s*true/g) ?? []).length, 2));
check("portable services provide writable temp space", () => assert.equal((compose.match(/tmpfs:/g) ?? []).length, 2));

check("no Azure SDK dependency exists", () => {
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  assert.equal(Object.keys(dependencies).some((name) => name.startsWith("@azure/")), false);
});
check("no Terraform, Bicep, or ARM template exists", () => {
  const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split("\n");
  assert.equal(files.some((path) => /(?:\.tf|\.tfvars|\.bicep)$|(?:azuredeploy|mainTemplate)\.json$/i.test(path)), false);
});
check("API route inventory includes the additive stock routes", () => assert.equal(trackedInventoryHash("app/api/**/route.ts"), "228a592cc11e0757c0f645b8b3c14c28367b6aad75cca19bef2be228b14df83f"));
check("migration inventory includes the additive stock migration", () => assert.equal(trackedInventoryHash("supabase/migrations/*"), "16445bc26288d5b1d2a0b6ab4b0864ca4d4e1c8065b3cfa07a48ca59b32c8755"));
check("dependency manifest contains only the new test commands", () => assert.equal(sha256("package.json"), "2a2822b30781db68aeab0e37ff4c638b5c85a5411552188142ce37b3296556d2"));
check("dependency lock is unchanged", () => assert.equal(sha256("package-lock.json"), "1d3ce079c07be440669c3ec43b5bcaa9a068a448355d4cf6ec9eb2ea4974c989"));
check("worker runtime is unchanged", () => assert.equal(sha256("lib/worker/runtime.mjs"), "e213b71c819e6cc26572dc0cb1d5be37c912d6b20b5d9e6318c05d07b1cbfaf6"));
check("export runtime includes economics dimensions", () => assert.equal(sha256("export-service/src/server.js"), "12cf471a134b858abc65163178efc9dc06ea9cc187ed39ea59c0991a7758eca3"));
check("container contracts are unchanged", () => {
  assert.equal(sha256("Dockerfile"), "7086c635d4196bf3e38f4640edf63dcd2a44e6b8b1a485faa46411190460707d");
  assert.equal(sha256("export-service/Dockerfile"), "95a5257335bc2730854e6b40b2bf3f5309734f1d01e4683d41c115b358d6f2cc");
  assert.equal(sha256("compose.yaml"), "3cd87654ca1ff919a46f75302b7f527bdcadcd994d6ca236d83ba42dd3f0046b");
});
check("Stage 0.8 closure worktree scope permits only reviewed later-stage additions", () => {
  const allowed = new Set([
    "docs/STAGE-0.8-STATUS.md",
    "docs/STAGE-0.8-ARCHITECTURE-CLOSURE.md",
    "scripts/stage-0-8a-critical-regression.mjs",
    "scripts/stage-0-8g-architecture-closure-test.mjs",
    "app/api/share-project/route.ts",
    "app/create/page.tsx",
    "app/signup/page.tsx",
    "lib/auth/supabaseAuthAdapter.ts",
    "lib/auth/types.ts",
    "lib/persistence/projects/supabaseProjectRepository.ts",
    "lib/persistence/projects/types.ts",
    "next.config.ts",
    "docs/STAGE-0.9-DATA-LIFECYCLE.md",
    "docs/STAGE-0.9-STATUS.md",
    "scripts/stage-0-9a-security-consent-baseline-test.mjs",
    ".env.container.example",
    "components/create/CreatorEditor.tsx",
    "components/create/CreatorStockPicker.tsx",
    "docs/STAGE-0.10C-PEXELS-SAFE-STOCK.md",
    "lib/persistence/media/registerStoredAsset.ts",
    "package.json",
    "scripts/stage-0-7a-2-final-movie-migration-test.mjs",
    "scripts/stage-0-7d-3a-final-export-admission-schema-test.mjs",
    "scripts/stage-0-8f-b-recovery-operator-test.mjs",
    "scripts/stage-0-10c-pexels-safe-stock-test.mjs",
    "supabase/migrations/20260822150000_stage_0_10c_pexels_safe_stock.sql",
  ]);
  const lines = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trimEnd().split("\n").filter(Boolean);
  const paths = lines.map((line) => line.slice(3).split(" -> ").at(-1));
  const allowedPrefixes = ["app/privacy/", "app/terms/", "components/legal/", "lib/legal/", "app/api/creator-stock/", "lib/providers/stock/"];
  assert.deepEqual(paths.filter((path) => !allowed.has(path) && !allowedPrefixes.some((prefix) => path.startsWith(prefix))), []);
});

console.log("\nSTAGE_0_8G_ARCHITECTURE_CLOSURE=PASS");
