import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const STARTING_HEAD = "f8030a723ba13cfb488db1ddbf3e577ae92ef3ee";
const read = (file) => fs.readFileSync(file, "utf8");
const changedFiles = execFileSync("git", ["diff", "--name-only", STARTING_HEAD], { encoding: "utf8" })
  .trim().split("\n").filter(Boolean);
const status = read("docs/STAGE-0.9-STATUS.md");
const lifecycle = read("docs/STAGE-0.9-DATA-LIFECYCLE.md");
const closure = read("docs/STAGE-0.9-CLOSURE.md");
const policy = read("lib/legal/policy.ts");
const signup = read("app/signup/page.tsx");
const authTypes = read("lib/auth/types.ts");
const authAdapter = read("lib/auth/supabaseAuthAdapter.ts");
const config = read("next.config.ts");
const shareRoute = read("app/api/share-project/route.ts");
const repositoryTypes = read("lib/persistence/projects/types.ts");
const repository = read("lib/persistence/projects/supabaseProjectRepository.ts");
const publicRoute = read("app/api/public-project/[shareId]/route.ts");
const projection = read("lib/security/publicStoryverseProjection.ts");

assert.match(status, /0\.9A Broad Security \/ Consent \/ Legal \/ Lifecycle Baseline: \*\*CLOSED \/ PASS\*\*/);
assert.match(status, /0\.9B High-Risk Identity & Data Lifecycle Decision Gate: \*\*CLOSED \/ PASS\*\*/);

assert.ok(status.includes("- 0.9C Closure: **CLOSED / PASS**"));
assert.ok(status.includes("- Stage 0.9 overall: **CLOSED / PASS**"));
assert.ok(closure.includes("Stage 0.9 is **CLOSED / PASS**"));
assert.ok(closure.includes("b6002f360a8e9741b6e450395ea44a80e759fc02"));
assert.ok(closure.includes("32525477396"));
assert.ok(closure.includes("04c2ccc7df2a4645f39c73018bb759b9f9849573"));
assert.ok(closure.includes("32526589498"));
assert.ok(closure.includes("external/public beta readiness"));
assert.ok(closure.includes("adult account holder aged 18+"));
assert.ok(closure.includes("Stage 0.7 media lifecycle remains authoritative"));

assert.ok(fs.existsSync("app/terms/page.tsx"));
assert.ok(fs.existsSync("app/privacy/page.tsx"));
assert.match(policy, /TERMS_VERSION\s*=\s*"[^"]+"/);
assert.match(policy, /PRIVACY_VERSION\s*=\s*"[^"]+"/);
assert.match(signup, /href={`\/terms\?lang=\$\{language\}`}/);
assert.match(signup, /href={`\/privacy\?lang=\$\{language\}`}/);
assert.match(signup, /if \(!termsAccepted\)/);
assert.match(signup, /type="checkbox"/);
for (const marker of ["acceptedTermsAt", "acceptedPrivacyAt", "termsVersion", "privacyVersion", "policyLocale"]) {
  assert.ok(authTypes.includes(marker) && signup.includes(marker), `signup contract missing ${marker}`);
}
for (const marker of ["accepted_terms_at", "accepted_privacy_at", "terms_version", "privacy_version", "policy_locale"]) {
  assert.ok(authAdapter.includes(marker), `user metadata missing ${marker}`);
}
assert.match(status, /not\*\* treated as the final authoritative immutable legal consent ledger/i);
assert.deepEqual(changedFiles.filter((file) => file.startsWith("supabase/migrations/") || file.startsWith("prisma/migrations/")), [
  "supabase/migrations/20260822100000_stage_0_10b_creator_economics.sql",
  "supabase/migrations/20260822150000_stage_0_10c_pexels_safe_stock.sql",
  "supabase/migrations/20260822170000_stage_0_10d_stock_import_claims.sql",
  "supabase/migrations/20260822200000_stage_0_10f_usage_indexes.sql",
].filter((file) => changedFiles.includes(file)));
assert.match(config, /X-Content-Type-Options[\s\S]*nosniff/);
assert.match(config, /Referrer-Policy[\s\S]*strict-origin-when-cross-origin/);
assert.match(config, /Permissions-Policy/);
assert.doesNotMatch(config, /Content-Security-Policy/i);
assert.match(shareRoute, /export async function DELETE/);
assert.ok(shareRoute.indexOf("authenticateRequest(req)", shareRoute.indexOf("export async function DELETE")) >= 0);
assert.match(repositoryTypes, /unpublishForOwner/);
assert.match(repository, /unpublishForOwner[\s\S]*owner_user_id[\s\S]*flow_type[\s\S]*storyverse[\s\S]*is_public: false/);
assert.match(shareRoute, /result\.status === "forbidden"/);
assert.match(shareRoute, /result\.status === "unsupported_flow"/);
assert.match(publicRoute, /getPublicByShareId/);
assert.match(repository, /\.eq\("is_public", true\)/);
for (const marker of ["PUBLIC_STORYVERSE_LIMITS", "mapPublicStoryverseEpisode", "maxSerializedDtoBytes", "safeMediaUrl"]) {
  assert.ok(projection.includes(marker), `bounded projection missing ${marker}`);
}

assert.match(status, /Automated account-wide deletion is \*\*not implemented in Stage 0\*\*/);
assert.match(status, /external\/public beta readiness blocker/);
assert.match(status, /does \*\*not\*\* provide independent child accounts/);
assert.match(status, /adult account holder aged \*\*18\+\*\*/);
assert.match(status, /Technical age verification and child\/guardian identity persistence are not\s+implemented/);
assert.match(status, /Before external\/public Storyverse release/);
assert.match(lifecycle, /adult account holder aged 18\+/);
assert.match(lifecycle, /Storyverse does not provide independent child accounts/);
assert.match(lifecycle, /external\/public Storyverse release requires a separate legal\/product gate/);
assert.match(lifecycle, /Trash is a recoverable logical state, still consumes storage/);
assert.match(lifecycle, /Automated account-wide deletion is not implemented in Stage 0/);
assert.match(status, /Storyverse child \/ guardian consent/);
assert.equal(changedFiles.some((file) => /azure|terraform|bicep/i.test(file)), false);
assert.equal(changedFiles.includes("package-lock.json"), false);

const basePackage = JSON.parse(execFileSync("git", ["show", `${STARTING_HEAD}:package.json`], { encoding: "utf8" }));
const currentPackage = JSON.parse(read("package.json"));
assert.deepEqual(currentPackage.dependencies, basePackage.dependencies);
assert.deepEqual(currentPackage.devDependencies, basePackage.devDependencies);

const reviewedProviderPrefixes = [
  "lib/providers/stock/",
  "lib/providers/music/",
  "lib/providers/research/",
];
for (const prefix of ["lib/providers/", "lib/credits/", "lib/queue/", "worker/"]) {
  const drifted = changedFiles.some((file) => {
    if (!file.startsWith(prefix)) return false;
    if (prefix === "lib/providers/") {
      return !reviewedProviderPrefixes.some((allowedPrefix) => file.startsWith(allowedPrefix));
    }
    return true;
  });
  assert.equal(drifted, false, `${prefix} behavior drifted`);
}

console.log("STAGE_0_9A_SECURITY_CONSENT_BASELINE=PASS");
console.log("STAGE_0_9_CLOSURE=PASS");
