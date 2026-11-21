import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CREATOR_PACKAGE_AI_DISCLOSURE,
  prepareCreatorPackageSyntheticDisclosure,
  resolveCreatorPackageDisclosureGovernance,
} from "../lib/creator/packageSyntheticDisclosure.ts";
import { createCreatorEvidenceGovernanceReport } from "../lib/creator/evidenceGovernance.ts";
import { createCreatorPublishReadyPackageReport } from "../lib/creator/publishReadyPackage.ts";

const initial = {
  productionPackage: { title: "Documentary", scenes: [{ id: 1 }], existing: "preserve" },
  metadata: { recommendedTitle: "Documentary", description: "Original description.", hashtags: ["AI"] },
  syntheticMediaCount: 36,
};
const prepared = prepareCreatorPackageSyntheticDisclosure(initial);
assert.equal(prepared.syntheticDisclosureIncluded, true);
assert.equal(prepared.productionPackage.existing, "preserve");
assert.equal(prepared.productionPackage.publishGovernance.syntheticDisclosurePresent, true);
assert.equal(prepared.metadata.description, "Original description.\n\n" + CREATOR_PACKAGE_AI_DISCLOSURE);
assert.deepEqual(prepared.metadata.hashtags, ["AI"]);

const repeated = prepareCreatorPackageSyntheticDisclosure({ ...initial, metadata: prepared.metadata });
assert.equal(repeated.metadata.description, prepared.metadata.description, "Disclosure must not repeat");

const noSynthetic = prepareCreatorPackageSyntheticDisclosure({ ...initial, syntheticMediaCount: 0 });
assert.equal(noSynthetic.syntheticDisclosureIncluded, false);
assert.deepEqual(noSynthetic.metadata, initial.metadata);
assert.deepEqual(noSynthetic.productionPackage, initial.productionPackage);

const disclosureOnly = createCreatorEvidenceGovernanceReport({
  syntheticMediaUsed: true,
  syntheticDisclosurePresent: false,
});
assert.equal(disclosureOnly.status, "review");
assert.equal(disclosureOnly.issues[0].code, "SYNTHETIC_DISCLOSURE_REQUIRED");
const resolved = resolveCreatorPackageDisclosureGovernance(disclosureOnly, prepared);
assert.equal(resolved.status, "ready");
assert.equal(resolved.issues.length, 0);
assert.equal(resolveCreatorPackageDisclosureGovernance(disclosureOnly, noSynthetic).status, "review");

const otherIssues = createCreatorEvidenceGovernanceReport({
  syntheticMediaUsed: true,
  syntheticDisclosurePresent: false,
  missingSourceIds: ["missing-research"],
  rightsReviewRequiredIds: ["uncleared-media"],
});
const stillBlocked = resolveCreatorPackageDisclosureGovernance(otherIssues, prepared);
assert.equal(stillBlocked.status, "blocked");
assert.ok(stillBlocked.issues.some(issue => issue.code === "MISSING_SOURCE"));
assert.ok(stillBlocked.issues.some(issue => issue.code === "RIGHTS_REVIEW_REQUIRED"));
assert.ok(!stillBlocked.issues.some(issue => issue.code === "SYNTHETIC_DISCLOSURE_REQUIRED"));

const route = fs.readFileSync(new URL("../app/api/export-creator-package/route.ts", import.meta.url), "utf8");
assert.match(route, /resolveCreatorProjectUsedMediaGovernance/);
assert.match(route, /prepareCreatorPackageSyntheticDisclosure/);
assert.match(route, /resolveCreatorPackageDisclosureGovernance/);
assert.match(route, /productionPackage:\s*preparedDisclosure\.productionPackage/);
assert.match(route, /metadata:\s*preparedDisclosure\.metadata/);
assert.match(route, /const productionPackage = preparedDisclosure\.productionPackage/);
assert.match(route, /const metadata = preparedDisclosure\.metadata/);
console.log("Creator Package automatic synthetic disclosure regression PASS");
