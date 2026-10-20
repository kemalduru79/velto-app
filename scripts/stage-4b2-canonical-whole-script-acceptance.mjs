import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assessStage4B2CanonicalWholeScript, missingStage4B2CanonicalSnapshotReport } from "../lib/creator/creatorScriptCanonicalAcceptance.ts";

const authorized = process.env.STAGE4B2_CANONICAL_SNAPSHOT_ACCEPTANCE === "confirmed-read-only";
const snapshotPath = process.env.STAGE4B2_CANONICAL_SNAPSHOT_PATH;
let report = missingStage4B2CanonicalSnapshotReport();
if (authorized && snapshotPath) {
  const absolute = resolve(snapshotPath);
  if (!absolute.startsWith(`${process.cwd()}/`) && !absolute.startsWith(`${process.env.HOME || ""}/Downloads/`)) throw new Error("CANONICAL_SNAPSHOT_PATH_NOT_ALLOWED");
  report = assessStage4B2CanonicalWholeScript(JSON.parse(await readFile(absolute, "utf8")));
}
console.log(JSON.stringify(report, null, 2));
if (report.status === "BLOCKED") process.exitCode = 1;
