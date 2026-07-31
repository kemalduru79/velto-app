import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const read = (file) => fs.readFileSync(file, "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const gateSource = read("lib/creator/finalProductionGate.ts");
const transpiled = ts.transpileModule(gateSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const tempFile = path.join(os.tmpdir(), `velto-3q-${Date.now()}.mjs`);
fs.writeFileSync(tempFile, transpiled, "utf8");
const gate = await import(pathToFileURL(tempFile).href);
fs.unlinkSync(tempFile);

const baseReadiness = {
  status: "ready",
  canStartFinalVideo: true,
  nextAction: "create_final_video",
  totalScenes: 2,
  readyVisualScenes: 2,
  readyVoiceScenes: 2,
  missingVisualSceneIds: [],
  missingVoiceSceneIds: [],
  blockingSceneIds: [],
};

assert(
  gate.createCreatorFinalProductionGate({ readiness: baseReadiness, exportServiceStatus: "ready" }).status === "ready",
  "Ready gate case failed.",
);
assert(
  gate.createCreatorFinalProductionGate({ readiness: baseReadiness, exportServiceStatus: "unavailable" }).canStartFinalVideo === false,
  "Unavailable export service must block the gate.",
);
assert(
  gate.createCreatorFinalProductionGate({
    readiness: { ...baseReadiness, status: "confirmation_required" },
    exportServiceStatus: "ready",
  }).status === "review",
  "Confirmation case must be review.",
);

const creatorExport = read("app/api/creator-export/route.ts");
const healthIndex = creatorExport.indexOf("await assertExportServiceReady(exportApiBase)");
const reserveIndex = creatorExport.indexOf("reserveMeteredOperation(request");
assert(healthIndex >= 0 && reserveIndex > healthIndex, "Export health must run before credit reservation.");
assert(creatorExport.includes("creditReserved: false"), "Blocked export response must confirm no credit reservation.");

const creatorHealth = read("app/api/creator-health/route.ts");
assert(creatorHealth.includes("/health"), "Creator health must probe the final video service.");
assert(creatorHealth.includes('stitchContinuityVersion === "3N-4"'), "Creator health must require 3N-4 compatibility.");

const exportService = read("export-service/src/server.js");
assert(exportService.includes('finalProductionGateCompatible: true'), "Export service compatibility flag missing.");

const page = read("app/create/page.tsx");
assert(page.includes("3Q ·"), "3Q Final Production Gate UI missing.");
assert(page.includes("createCreatorFinalProductionGate"), "3Q gate integration missing.");
assert(page.includes('operationalStatus?.services.export'), "Final export does not check live service readiness.");

console.log("3Q Final Production Gate smoke test passed.");
