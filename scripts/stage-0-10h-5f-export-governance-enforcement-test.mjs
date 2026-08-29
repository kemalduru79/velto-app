import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("app/api/creator-export/route.ts", "utf8");
const projectRoute = fs.readFileSync(
  "app/api/creator-project-governance/[projectId]/route.ts",
  "utf8",
);
const serverResolver = fs.readFileSync(
  "lib/creator/usedMediaGovernance.server.ts",
  "utf8",
);

const projectLookup = route.indexOf("projectRepository.getForOwner(requestedProjectId, principal.id)");
const governanceResolve = route.indexOf("resolveCreatorProjectUsedMediaGovernance({");
const blockedCheck = route.indexOf('evidenceGovernance?.status === "blocked"');
const exportServiceCheck = route.indexOf("getExportApiBase()");
const creditReservation = route.indexOf("creditReservation = await reserveMeteredOperation");

assert.ok(projectLookup >= 0, "Creator export must resolve the owner-scoped project.");
assert.ok(governanceResolve > projectLookup, "Governance must run after owner-scoped project lookup.");
assert.ok(blockedCheck > governanceResolve, "Blocked governance must be evaluated after resolution.");
assert.ok(exportServiceCheck > blockedCheck, "Governance must block before export-service work.");
assert.ok(creditReservation > blockedCheck, "Governance must block before credit reservation.");
assert.match(route, /project\.flow_type === "creator_lab"\s*\? "creatorlab"/);
assert.match(route, /creatorGovernanceExportBlockResponse\(evidenceGovernance\)/);
assert.match(route, /status:\s*409/);
assert.match(route, /evidenceGovernanceStatus:\s*evidenceGovernance\?\.status \|\| "not_applicable"/);
assert.match(route, /evidenceGovernance:\s*evidenceGovernance/);
assert.doesNotMatch(
  route,
  /evidenceGovernance\?\.status\s*!==\s*["']ready["']/,
  "Review governance must not be treated as an automatic export block.",
);

assert.match(serverResolver, /inspectProjectMediaReferences\(input\.project\)/);
assert.match(serverResolver, /reference\.referenceType === "scene_image"/);
assert.match(serverResolver, /reference\.referenceType === "scene_video"/);
assert.match(serverResolver, /findByPublicUrl\(input\.ownerUserId, url\)/);
assert.match(serverResolver, /createCreatorUsedMediaGovernanceResult/);
assert.match(serverResolver, /creditReserved:\s*false/);
assert.match(serverResolver, /creator_export_governance_blocked/);
assert.doesNotMatch(serverResolver, /legally safe|safe to use/i);

assert.match(projectRoute, /resolveCreatorProjectUsedMediaGovernance/);
assert.doesNotMatch(projectRoute, /inspectProjectMediaReferences/);
assert.doesNotMatch(projectRoute, /findByPublicUrl/);

console.log("Stage 0.10H-5F export governance enforcement tests passed.");
