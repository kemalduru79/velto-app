import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assessStage4B2CanonicalWholeScript, missingStage4B2CanonicalSnapshotReport } from "../lib/creator/creatorScriptCanonicalAcceptance.ts";

const authorized = process.env.STAGE4B2_CANONICAL_SNAPSHOT_ACCEPTANCE === "confirmed-read-only";
const snapshotPath = process.env.STAGE4B2_CANONICAL_SNAPSHOT_PATH;
const manifestPath = process.env.STAGE4B2_CANONICAL_MANIFEST_PATH;
const expectedManifestSha256 = process.env.STAGE4B2_CANONICAL_MANIFEST_SHA256;
let report = missingStage4B2CanonicalSnapshotReport();
if (authorized && snapshotPath && manifestPath && /^[a-f0-9]{64}$/u.test(expectedManifestSha256 || "")) {
  const absolute = resolve(snapshotPath); const manifestAbsolute = resolve(manifestPath);
  const allowed = (value) => value.startsWith(`${process.cwd()}/`) || value.startsWith(`${process.env.HOME || ""}/Downloads/`);
  if (!allowed(absolute) || !allowed(manifestAbsolute) || absolute === manifestAbsolute) throw new Error("CANONICAL_ACCEPTANCE_PATH_NOT_ALLOWED");
  try {
    const snapshot = JSON.parse(await readFile(absolute, "utf8")); const manifest = JSON.parse(await readFile(manifestAbsolute, "utf8"));
    report = assessStage4B2CanonicalWholeScript(snapshot, { manifest, expectedManifestSha256, boundary: "detached_read_only_hash_pin" });
  } catch { report = assessStage4B2CanonicalWholeScript(null, null); }
}
console.log(JSON.stringify(report, null, 2));
if (report.status === "BLOCKED") process.exitCode = 1;
