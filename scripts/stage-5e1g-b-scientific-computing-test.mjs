import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, stat, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  SCIENTIFIC_CALCULATION_METHODS,
  SCIENTIFIC_CALCULATION_REQUEST_VERSION,
  buildScientificContainerInvocation,
  computeScientificCalculationInputDataSha256,
  computeScientificCalculationRequestIdentity,
  loadScientificContainerRuntimeManifest,
  runScientificCalculation,
  scientificSha256,
  validateScientificContainerRuntimeManifest,
} from "../lib/creator/scientificReview/index.ts";

let passed = 0;
let observedFetches = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { observedFetches += 1; throw new Error("NETWORK_FORBIDDEN"); };

async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}
async function workspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), "stage-5e1g-b-"));
  await mkdir(path.join(root, "runs"), { mode: 0o700 });
  return root;
}
function request(operation, parameters, operationId = `operation-${operation}`) {
  const dataKeys = Object.keys(parameters).sort();
  const sourceBindings = [{
    sourceId: "synthetic-source-1", sourceVersion: "synthetic-v1",
    documentSha256: scientificSha256("synthetic-document"), evidenceIds: ["synthetic-evidence-1"],
    dataKeys,
    dataFingerprintSha256: scientificSha256(JSON.stringify(Object.fromEntries(dataKeys.map((key) => [key, parameters[key]])))),
  }];
  const identityInput = {
    version: SCIENTIFIC_CALCULATION_REQUEST_VERSION, operationId, operation,
    method: SCIENTIFIC_CALCULATION_METHODS[operation], sourceBindings, parameters,
    inputDataSha256: computeScientificCalculationInputDataSha256(parameters),
    precision: { decimalPlaces: 12, absoluteTolerance: 1e-10, relativeTolerance: 1e-10 },
    limitations: ["SYNTHETIC_REFERENCE_FIXTURE_ONLY"],
  };
  return { ...identityInput, requestIdentitySha256: computeScientificCalculationRequestIdentity(identityInput) };
}
async function calculate(operation, parameters, suffix) {
  const root = await workspace();
  const runDirectory = path.join(root, "runs", suffix);
  const receipt = await runScientificCalculation(request(operation, parameters, `operation-${suffix}`), { runDirectory });
  return { receipt, runDirectory };
}
function close(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

await test("independently computed descriptive fixture matches", async () => {
  const { receipt } = await calculate("descriptive_statistics_v1", { values: [1, 2, 3, 4], ddof: 1 }, "descriptive");
  assert.equal(receipt.numericalResult.n, 4);
  close(receipt.numericalResult.mean, 2.5);
  close(receipt.numericalResult.variance, 5 / 3);
  close(receipt.numericalResult.standardDeviation, Math.sqrt(5 / 3));
  assert.equal(receipt.authority, "COMPUTED_NUMERICAL_RESULT_ONLY");
  assert.equal(receipt.sourceAuthenticityEstablished, false);
  assert.equal(receipt.scientificInterpretationEstablished, false);
  assert.equal(receipt.qualifiedHumanApproval, false);
});

await test("effect size fixture uses explicit pooled-sample method", async () => {
  const { receipt } = await calculate("cohens_d_independent_v1", { groupA: [1, 2, 3], groupB: [2, 4, 6] }, "cohens-d");
  close(receipt.numericalResult.pooledStandardDeviation, Math.sqrt(2.5));
  close(receipt.numericalResult.cohensD, -2 / Math.sqrt(2.5));
  assert.equal(receipt.method, "pooled_standardized_mean_difference_v1");
});

await test("known-sigma confidence interval matches reference calculation", async () => {
  const { receipt } = await calculate("normal_mean_ci_known_sigma_v1", {
    values: [10, 12, 14, 16], populationSigma: 4, confidenceLevel: 0.95,
  }, "known-sigma-ci");
  const margin = 1.959963984540054 * 4 / 2;
  close(receipt.numericalResult.mean, 13);
  close(receipt.numericalResult.marginOfError, margin);
  close(receipt.numericalResult.lower, 13 - margin);
  close(receipt.numericalResult.upper, 13 + margin);
});

await test("growth and model-fit fixtures preserve observation/model distinction", async () => {
  const growth = await calculate("exponential_growth_doubling_v1", { startValue: 1, endValue: 8, elapsedTime: 6 }, "growth");
  close(growth.receipt.numericalResult.logGrowthRatePerUnit, Math.log(8) / 6);
  close(growth.receipt.numericalResult.doublingTime, 2);
  assert.ok(growth.receipt.limitations.includes("TWO_POINT_EXPONENTIAL_SUMMARY_NOT_A_MODEL_VALIDATION"));
  const fit = await calculate("log_linear_model_fit_v1", { x: [0, 1, 2, 3], y: [1, 2, 4, 8] }, "model-fit");
  close(fit.receipt.numericalResult.logSlope, Math.log(2));
  close(fit.receipt.numericalResult.rSquaredLogSpace, 1);
  close(fit.receipt.numericalResult.doublingTime, 1);
  assert.ok(fit.receipt.limitations.includes("FIT_DIAGNOSTIC_NOT_FORECAST_AUTHORITY"));
});

await test("receipts are deterministic and private durable files", async () => {
  const parameters = { values: [3, 5, 7], ddof: 0 };
  const first = await calculate("descriptive_statistics_v1", parameters, "deterministic-a");
  const second = await calculate("descriptive_statistics_v1", parameters, "deterministic-a");
  assert.deepEqual(first.receipt, second.receipt);
  assert.equal((await stat(first.runDirectory)).mode & 0o077, 0);
  for (const file of ["request.json", "attempt-0001-consumed.json", "receipt.json", "audit.json"]) {
    assert.equal((await stat(path.join(first.runDirectory, file))).mode & 0o077, 0);
  }
  const audit = await readFile(path.join(first.runDirectory, "audit.json"), "utf8");
  assert.equal(audit.includes("synthetic-document"), false);
  assert.equal(audit.includes("credentials"), true);
});

await test("malformed, nonfinite, unsupported, and hash-drift inputs fail before execution", async () => {
  const root = await workspace();
  const invalid = request("descriptive_statistics_v1", { values: [1, 2], ddof: 0 }, "invalid-input");
  invalid.parameters.values[0] = Number.NaN;
  await assert.rejects(runScientificCalculation(invalid, { runDirectory: path.join(root, "runs", "nan") }), /PARAMETER_NUMBER_INVALID/);
  const unsupported = { ...request("descriptive_statistics_v1", { values: [1], ddof: 0 }, "unsupported"), operation: "arbitrary_python_v1", method: "exec" };
  await assert.rejects(runScientificCalculation(unsupported, { runDirectory: path.join(root, "runs", "unsupported") }), /REQUEST_VERSION_OR_OPERATION_INVALID/);
  const drift = request("descriptive_statistics_v1", { values: [1], ddof: 0 }, "hash-drift");
  drift.inputDataSha256 = scientificSha256("wrong");
  const { requestIdentitySha256: _ignored, ...identityInput } = drift;
  drift.requestIdentitySha256 = computeScientificCalculationRequestIdentity(identityInput);
  await assert.rejects(runScientificCalculation(drift, { runDirectory: path.join(root, "runs", "hash") }), /INPUT_DATA_HASH_MISMATCH/);
  const sourceDrift = request("descriptive_statistics_v1", { values: [1], ddof: 0 }, "source-hash-drift");
  sourceDrift.sourceBindings[0].dataFingerprintSha256 = scientificSha256("wrong-source-data");
  const { requestIdentitySha256: _sourceIgnored, ...sourceIdentityInput } = sourceDrift;
  sourceDrift.requestIdentitySha256 = computeScientificCalculationRequestIdentity(sourceIdentityInput);
  await assert.rejects(runScientificCalculation(sourceDrift, { runDirectory: path.join(root, "runs", "source-hash") }), /SOURCE_DATA_FINGERPRINT_MISMATCH/);
});

await test("missing data and numerically unstable inputs fail closed with terminal markers", async () => {
  const root = await workspace();
  await assert.rejects(runScientificCalculation(request("descriptive_statistics_v1", {}, "missing-structure"), {
    runDirectory: path.join(root, "runs", "missing-structure"),
  }), /SOURCE_BINDING_INVALID/);
  const missingDir = path.join(root, "runs", "missing");
  await assert.rejects(runScientificCalculation(request("descriptive_statistics_v1", { values: [], ddof: 0 }, "missing"), { runDirectory: missingDir }), /VALUES_INVALID/);
  const missingFailure = JSON.parse(await readFile(path.join(missingDir, "failure.json"), "utf8"));
  assert.equal(missingFailure.state, "TERMINAL_NO_AUTOMATIC_RETRY");
  await assert.rejects(runScientificCalculation(request("cohens_d_independent_v1", { groupA: [1, 1], groupB: [1, 1] }, "unstable"), {
    runDirectory: path.join(root, "runs", "unstable"),
  }), /POOLED_VARIANCE_UNSTABLE/);
  await assert.rejects(runScientificCalculation(request("log_linear_model_fit_v1", { x: [1, 1, 1], y: [1, 2, 3] }, "singular"), {
    runDirectory: path.join(root, "runs", "singular"),
  }), /SINGULAR_MODEL_FIT/);
});

await test("unprovisioned pinned SciPy container fails closed after durable admission", async () => {
  const root = await workspace();
  const runDirectory = path.join(root, "runs", "scipy");
  await assert.rejects(runScientificCalculation(request("mean_t_ci_scipy_v1", { values: [1, 2, 3], confidenceLevel: 0.95 }, "scipy-missing"), {
    runDirectory,
  }), /CONTAINER_RUNTIME_NOT_PROVISIONED/);
  const attempt = JSON.parse(await readFile(path.join(runDirectory, "attempt-0001-consumed.json"), "utf8"));
  const failure = JSON.parse(await readFile(path.join(runDirectory, "failure.json"), "utf8"));
  assert.equal(attempt.state, "authorization_consumed_before_trusted_worker_dispatch");
  assert.equal(attempt.automaticRetry, false);
  assert.equal(failure.state, "TERMINAL_NO_AUTOMATIC_RETRY");
  assert.equal(failure.reason, "STAGE_5E1G_B_CONTAINER_RUNTIME_NOT_PROVISIONED");
});

await test("host container manifest records blockers without inventing image or dependency authority", async () => {
  const manifest = await loadScientificContainerRuntimeManifest();
  assert.equal(manifest.status, "BLOCKED_UNPROVISIONED");
  assert.deepEqual(manifest.image, { reference: null, imageId: null, repoDigest: null });
  assert.deepEqual(manifest.dependencies, {
    python: null, pythonExecutable: null, pythonExecutableSha256: null,
    numpy: null, numpyDistributionSha256: null, scipy: null, scipyDistributionSha256: null,
  });
  assert.ok(manifest.blockerCodes.includes("TRIXIE_ZLIB_HIGH_VULNERABILITY_UNRESOLVED"));
  assert.ok(manifest.blockerCodes.includes("TRIXIE_PACKAGING_TOOLCHAIN_REMOVAL_NOT_VERIFIED"));
  assert.ok(manifest.blockerCodes.includes("PINNED_BASE_IMAGE_NOT_LOCALLY_AVAILABLE"));
  assert.ok(manifest.blockerCodes.includes("PINNED_WHEELS_NOT_LOCALLY_AVAILABLE"));
  assert.ok(manifest.blockerCodes.includes("PROVISIONED_WORKER_IMAGE_NOT_BUILT"));
  await assert.rejects(async () => buildScientificContainerInvocation(manifest), /CONTAINER_RUNTIME_NOT_PROVISIONED/);
});

await test("ready container invocation is digest-only, mount-free, and fully resource constrained", async () => {
  const digest = "a".repeat(64);
  const ready = validateScientificContainerRuntimeManifest({
    version: "stage-5e1g-b-container-runtime-v1", status: "READY", blockerCodes: [],
    engine: {
      executable: "/opt/verified/docker", executableSha256: "b".repeat(64), version: "29.6.2",
    },
    hostArchitecture: "arm64", targetPlatform: "linux/arm64",
    image: {
      reference: `registry.invalid/velto/scientific-compute@sha256:${digest}`,
      imageId: `sha256:${"c".repeat(64)}`,
      repoDigest: `registry.invalid/velto/scientific-compute@sha256:${digest}`,
    },
    dependencies: {
      python: "3.13.9", pythonExecutable: "/usr/local/bin/python3",
      pythonExecutableSha256: "e".repeat(64), numpy: "2.3.4",
      numpyDistributionSha256: "f".repeat(64), scipy: "1.16.3",
      scipyDistributionSha256: "1".repeat(64),
    },
    worker: { containerPath: "/opt/velto/scientific_compute_v1.py", sha256: "d".repeat(64) },
    limits: {
      cpus: 1, memoryBytes: 536870912, pids: 64, tmpfsBytes: 67108864,
      timeoutMs: 5000, maximumInputBytes: 1000000, maximumOutputBytes: 1000000,
    },
    isolation: {
      network: "none", readOnlyRoot: true, user: "65532:65532", noNewPrivileges: true,
      dropCapabilities: "ALL", pullPolicy: "never", mounts: "NONE", tmpfsOptions: "rw,noexec,nosuid,nodev",
    },
  });
  const invocation = buildScientificContainerInvocation(ready);
  const joined = invocation.args.join(" ");
  for (const required of [
    "--pull never", "--network none", "--read-only", "--user 65532:65532",
    "--security-opt no-new-privileges=true", "--cap-drop ALL", "--cpus 1",
    "--memory 536870912", "--memory-swap 536870912", "--pids-limit 64",
    "--tmpfs /tmp:rw,noexec,nosuid,nodev,size=67108864,mode=1777",
  ]) assert.ok(joined.includes(required), `missing ${required}`);
  assert.equal(joined.includes("--mount"), false);
  assert.equal(joined.includes("--volume"), false);
  assert.ok(joined.includes(`@sha256:${digest}`));
  assert.equal(invocation.imageDigest, ready.image.repoDigest);

  const mutable = structuredClone(ready);
  mutable.image.reference = "registry.invalid/velto/scientific-compute:latest";
  assert.throws(() => validateScientificContainerRuntimeManifest(mutable), /CONTAINER_IMAGE_IDENTITY_INVALID/);
  const weakened = structuredClone(ready);
  weakened.isolation.network = "bridge";
  assert.throws(() => validateScientificContainerRuntimeManifest(weakened), /CONTAINER_ISOLATION_POLICY_INVALID/);
});

await test("Python and worker version drift fail closed", async () => {
  const worker = path.resolve("scripts/scientific-review/scientific_compute_v1.py");
  const payload = JSON.stringify({
    workerVersion: "stage-5e1g-b-python-worker-v1", expectedPythonVersion: "0.0.0",
    expectedScipyVersion: "1.13.1", operation: "descriptive_statistics_v1",
    parameters: { values: [1], ddof: 0 }, precision: 12,
  });
  const result = spawnSync("/usr/bin/python3", ["-I", "-B", worker], { input: payload, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /PYTHON_VERSION_DRIFT/);
});

await test("timeout consumes the attempt and replay cannot redispatch", async () => {
  const root = await workspace();
  const runDirectory = path.join(root, "runs", "timeout");
  const value = request("descriptive_statistics_v1", { values: Array.from({ length: 10_000 }, (_, index) => index), ddof: 1 }, "timeout");
  await assert.rejects(runScientificCalculation(value, { runDirectory, timeoutMs: 1 }), /CALCULATION_TIMEOUT/);
  assert.equal((await stat(path.join(runDirectory, "attempt-0001-consumed.json"))).mode & 0o077, 0);
  await assert.rejects(runScientificCalculation(value, { runDirectory }), /RUN_ALREADY_EXISTS_OR_UNAVAILABLE/);
});

await test("symlinked output parents are rejected", async () => {
  const root = await workspace();
  const realParent = path.join(root, "private-real");
  await mkdir(realParent, { mode: 0o700 });
  const linkedParent = path.join(root, "private-link");
  await symlink(realParent, linkedParent);
  await assert.rejects(runScientificCalculation(request("descriptive_statistics_v1", { values: [1], ddof: 0 }, "symlink"), {
    runDirectory: path.join(linkedParent, "run"),
  }), /PRIVATE_PARENT_REQUIRED|PARENT_REALPATH_MISMATCH/);
});

await test("the trusted worker contains no arbitrary-code, shell, or network imports", async () => {
  const worker = await readFile("scripts/scientific-review/scientific_compute_v1.py", "utf8");
  assert.doesNotMatch(worker, /\b(eval|exec|compile|__import__)\s*\(/);
  assert.doesNotMatch(worker, /^\s*(import|from)\s+(socket|urllib|http|requests|subprocess)\b/m);
  assert.equal(observedFetches, 0);
});

globalThis.fetch = originalFetch;
console.log(`STAGE_5E1G_B_SCIENTIFIC_COMPUTING=PASS (${passed}/14)`);
console.log("SCIPY_BACKED_OPERATION=BLOCKED_CONTAINER_UNPROVISIONED");
console.log("CONTAINER_POLICY_STATIC_VALIDATION=PASS");
console.log("CONTAINER_ISOLATION_EXECUTION=BLOCKED_RUNTIME_ARTIFACTS_UNAVAILABLE");
console.log("NETWORK_ISOLATION=NOT_EXECUTED");
console.log("LIVE_NO_GO=true");
console.log("MOCK_ONLY=true");
