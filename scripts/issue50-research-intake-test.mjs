import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import * as creatorScript from "../lib/creator/creatorScript.ts";
import { prepareResearchIntake } from "./issue50-research-intake.mjs";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const corpus = JSON.parse(fs.readFileSync("scripts/fixtures/issue50-research-corpus-v2.json"));
const intake = prepareResearchIntake(); let assertions = 0; const check = (fn) => { fn(); assertions++; };
check(() => assert.equal(intake.readiness.eligible, true)); check(() => assert.deepEqual(intake.readiness.reasonCodes, []));
check(() => assert.equal(intake.generationInput.editorialContext.readiness.status, "review")); check(() => assert.equal(intake.generationInput.editorialContext.readiness.editorialReadinessScore, 0));
check(() => assert.equal(intake.ownerAccepted, false)); check(() => assert.equal(intake.providerAuthorized, false));
check(() => assert.equal(corpus.sources.length, 3)); check(() => assert.equal(corpus.evidence.length, 12));
for (const source of corpus.sources) {
  check(() => assert.match(source.url, /^https:\/\/(arxiv\.org|www\.frontiersin\.org|link\.springer\.com)\//));
  if (process.argv[2]) { const raw = fs.readFileSync(path.join(process.argv[2], source.sourceId + ".html")); check(() => assert.equal(hash(raw), source.sha256)); for (const e of corpus.evidence.filter((e) => e.sourceId === source.sourceId)) check(() => assert.equal(hash(raw.subarray(e.rawByteStart, e.rawByteEnd)), e.rawPassageSha256)); }
}
for (const e of corpus.evidence) check(() => assert.equal(hash(e.summary), e.summarySha256));
for (const route of intake.generationInput.sectionClaimRouting) check(() => assert.ok(route.claimIds.length > 0 && !route.usedFallback));
const require = createRequire(import.meta.url); const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/creator/creatorScriptBuildProviders.server.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, process: { env: {} }, require: (name) => { if (name === "node:crypto") return require(name); if (name === "./creatorScript.ts") return creatorScript; return {}; } });
const calls = [];
await exports.executeCreatorScriptBuildScriptGenerationProvider({ ownerId: "offline-public-pilot", projectId: "offline-no-persistence", value: intake.generationInput, runJson: async (request) => { calls.push(request); return { id: request.user.activeSection.id, heading: "OFFLINE PLACEHOLDER", text: "x".repeat(1000), claimIds: request.user.activeSectionClaimAuthority.claimIds }; } });
check(() => assert.equal(calls.length, 5));
for (const [i, request] of calls.entries()) { check(() => assert.equal(request.user.completedSections.length, i)); check(() => assert.ok(request.user.activeSectionEvidenceSelection.units.length > 0)); }
const measurements = calls.map((r, i) => ({ ordinal: i + 1, sectionId: r.user.activeSection.id, systemUtf8Bytes: Buffer.byteLength(r.system), userUtf8BytesWithSyntheticPriorSections: Buffer.byteLength(JSON.stringify(r.user)), schemaUtf8Bytes: Buffer.byteLength(JSON.stringify(r.schema)), tokenCount: "UNVERIFIED_NO_MODEL_COMPATIBLE_TOKENIZER_OR_AUTHORIZED_COUNT_API", actualDynamicInputsMustBeReadmitted: true }));
if (process.env.ISSUE50_MEASUREMENTS_OUTPUT) fs.writeFileSync(process.env.ISSUE50_MEASUREMENTS_OUTPUT, JSON.stringify(measurements, null, 2) + "\n");
console.log(JSON.stringify({ status: "PASS", assertions, eligible: true, sections: 5, sourcePassages: 12, ownerAccepted: false, providerCalls: 0, documentBytesReverified: Boolean(process.argv[2]), tokenAuthority: "UNVERIFIED" }));
