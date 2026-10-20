#!/usr/bin/env node
import { constants } from "node:fs";
import { access, chmod, lstat, readFile, realpath, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createStage4B2EOwnerCanonicalCapture, compareStage4B2ECaptures } from "../lib/creator/stage4b2CanonicalCapture.ts";

const [mode, ...rawArgs] = process.argv.slice(2);
const args = Object.fromEntries(rawArgs.flatMap((value, index) => value.startsWith("--") ? [[value.slice(2), rawArgs[index + 1]]] : []));
const projectId = String(args["project-id"] || "");
const baseUrl = String(args["base-url"] || "").replace(/\/+$/u, "");
const outputInput = String(args["output-dir"] || "");
const readOnlyConfirmed = args["confirm-read-only-capture"] === "owner-reviewed";
const privateStorageConfirmed = args["confirm-private-encrypted-storage"] === "yes";
const projectPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const expectedProjectId = "e572838e-98ab-42cd-92f4-bf56658cad77";
const maxResponseBytes = 25 * 1024 * 1024;

if (!["capture", "verify-after"].includes(mode) || projectId !== expectedProjectId || !projectPattern.test(projectId) || !outputInput || !readOnlyConfirmed || !privateStorageConfirmed) {
  throw new Error("Usage: stage-4b2e-owner-canonical-capture.mjs <capture|verify-after> --base-url <approved-origin> --project-id e572838e-98ab-42cd-92f4-bf56658cad77 --output-dir <private-existing-directory> --confirm-read-only-capture owner-reviewed --confirm-private-encrypted-storage yes");
}
const origin = new URL(baseUrl);
const approvedProductionOrigin = "https://velto-app-one.vercel.app";
const approvedLoopback = origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname);
if (origin.pathname !== "/" || origin.search || origin.hash || (origin.origin !== approvedProductionOrigin && !approvedLoopback)) {
  throw new Error("CANONICAL_CAPTURE_BASE_URL_NOT_ALLOWED");
}

const repoRoot = await realpath(process.cwd());
const unresolvedOutputDir = resolve(outputInput);
const unresolvedOutputStat = await lstat(unresolvedOutputDir);
if (unresolvedOutputStat.isSymbolicLink()) throw new Error("CANONICAL_CAPTURE_OUTPUT_DIRECTORY_SYMLINK_NOT_ALLOWED");
const outputDir = await realpath(unresolvedOutputDir);
if (outputDir === repoRoot || outputDir.startsWith(`${repoRoot}${sep}`)) throw new Error("CANONICAL_CAPTURE_OUTPUT_MUST_BE_OUTSIDE_REPOSITORY");
const outputStat = await lstat(outputDir);
if (!outputStat.isDirectory() || (outputStat.mode & 0o077) !== 0) throw new Error("CANONICAL_CAPTURE_OUTPUT_DIRECTORY_MUST_BE_PRIVATE_0700");

async function hiddenToken() {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== "function") throw new Error("CANONICAL_CAPTURE_INTERACTIVE_TTY_REQUIRED");
  process.stdout.write("Owner access token (hidden; never logged or stored): ");
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding("utf8");
  return await new Promise((resolveToken, reject) => {
    let token = "";
    const finish = (error) => {
      process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.removeListener("data", onData); process.stdout.write("\n");
      if (error) reject(error); else resolveToken(token.trim());
    };
    const onData = (chunk) => {
      if (chunk === "\u0003") return finish(new Error("CANONICAL_CAPTURE_CANCELLED"));
      if (chunk.includes("\r") || chunk.includes("\n")) return finish();
      if (chunk === "\u007f") token = token.slice(0, -1); else token += chunk;
      if (token.length > 16384) finish(new Error("CANONICAL_CAPTURE_TOKEN_TOO_LARGE"));
    };
    process.stdin.on("data", onData);
  });
}

async function fetchOwnedProject(token) {
  if (!token) throw new Error("CANONICAL_CAPTURE_TOKEN_MISSING");
  const response = await fetch(`${origin.origin}/api/load-project/${encodeURIComponent(projectId)}`, {
    method: "GET", headers: { Accept: "application/json", Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "manual",
  });
  if (response.status !== 200) throw new Error(`CANONICAL_CAPTURE_HTTP_${response.status}`);
  if (!String(response.headers.get("content-type") || "").toLowerCase().includes("application/json")) throw new Error("CANONICAL_CAPTURE_CONTENT_TYPE_INVALID");
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > maxResponseBytes) throw new Error("CANONICAL_CAPTURE_RESPONSE_TOO_LARGE");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxResponseBytes) throw new Error("CANONICAL_CAPTURE_RESPONSE_TOO_LARGE");
  const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (parsed?.success !== true || !parsed.project) throw new Error("CANONICAL_CAPTURE_RESPONSE_INVALID");
  return { bytes, project: parsed.project };
}

async function writePrivate(name, value, raw = false) {
  const path = resolve(outputDir, name);
  await writeFile(path, raw ? value : `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  await chmod(path, 0o600);
}

const exists = async (name) => access(resolve(outputDir, name), constants.F_OK).then(() => true, () => false);
const beforeNames = ["stage4b2e-private-before-response.json", "stage4b2e-private-baseline-intake.json", "stage4b2e-redacted-before-report.json"];
const afterNames = ["stage4b2e-private-after-response.json", "stage4b2e-redacted-after-report.json", "stage4b2e-redacted-before-after-comparison.json"];
if (mode === "capture" && (await Promise.all(beforeNames.map(exists))).some(Boolean)) throw new Error("CANONICAL_CAPTURE_BEFORE_ALREADY_EXISTS");
if (mode === "verify-after" && (!(await exists(beforeNames[0])) || !(await exists(beforeNames[2])) || (await Promise.all(afterNames.map(exists))).some(Boolean))) {
  throw new Error("CANONICAL_CAPTURE_AFTER_PRECONDITION_FAILED");
}

const token = await hiddenToken();
const captured = await fetchOwnedProject(token);
const result = createStage4B2EOwnerCanonicalCapture({ projectValue: captured.project, rawResponseBytes: captured.bytes, expectedProjectId: projectId });
if (mode === "capture") {
  await writePrivate("stage4b2e-private-before-response.json", captured.bytes, true);
  await writePrivate("stage4b2e-private-baseline-intake.json", result.intake);
  await writePrivate("stage4b2e-redacted-before-report.json", result.report);
  console.log(JSON.stringify(result.report, null, 2));
} else {
  const before = JSON.parse(await readFile(resolve(outputDir, "stage4b2e-redacted-before-report.json"), "utf8"));
  const comparison = compareStage4B2ECaptures(before, result.report);
  await writePrivate("stage4b2e-private-after-response.json", captured.bytes, true);
  await writePrivate("stage4b2e-redacted-after-report.json", result.report);
  await writePrivate("stage4b2e-redacted-before-after-comparison.json", comparison);
  console.log(JSON.stringify(comparison, null, 2));
  if (comparison.status !== "UNCHANGED") process.exitCode = 1;
}
