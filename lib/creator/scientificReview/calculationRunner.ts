import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, mkdir, open, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SCIENTIFIC_CALCULATION_RECEIPT_VERSION,
  scientificCalculationFail,
  validateScientificCalculationRequest,
} from "./calculationContracts.ts";
import type { ScientificCalculationReceipt, ScientificCalculationRequest } from "./calculationContracts.ts";
import { scientificSha256, stableScientificJson } from "./authorityContracts.ts";
import { assertScientificContainerRuntimeReady } from "./containerRuntime.ts";

type RuntimeManifest = Readonly<{
  version: "stage-5e1g-b-runtime-manifest-v1";
  profileId: string;
  pythonExecutable: string;
  pythonExecutableSha256: string;
  pythonVersion: string;
  scipyVersion: string;
  workerPath: string;
  workerSha256: string;
  maximumInputBytes: number;
  maximumOutputBytes: number;
  defaultTimeoutMs: number;
  maximumTimeoutMs: number;
  operations: readonly string[];
  scipyRequiredOperations: readonly string[];
  networkIsolation: "NOT_OS_ENFORCED";
  shellExecution: false;
  arbitraryCode: false;
}>;

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const RUNTIME_MANIFEST_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "scientificComputeRuntime.v1.json");
const RUNTIME_MANIFEST_SHA256 = "2af160c81ce74fb0f861db8acc88497e3dbaecbd4f771db672db54cec70ceac3";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function exactKeys(value: unknown, keys: readonly string[], label: string) {
  if (!isRecord(value) || Object.keys(value).some((key) => !keys.includes(key)) || keys.some((key) => !(key in value))) {
    scientificCalculationFail(`CALCULATION_${label}_SCHEMA_INVALID`);
  }
}
function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
function isApprovedDarwinSystemAlias(parent: string, resolvedParent: string): boolean {
  if (process.platform !== "darwin") return false;
  const systemAlias = parent === "/var" || parent.startsWith("/var/") || parent === "/tmp" || parent.startsWith("/tmp/");
  return systemAlias && resolvedParent === `/private${parent}`;
}
async function privateCanonicalParent(inputPath: string): Promise<string> {
  if (!path.isAbsolute(inputPath)) scientificCalculationFail("CALCULATION_ABSOLUTE_PATH_REQUIRED");
  const parent = path.dirname(path.resolve(inputPath));
  const stat = await lstat(parent).catch(() => scientificCalculationFail("CALCULATION_PARENT_UNAVAILABLE"));
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) scientificCalculationFail("CALCULATION_PRIVATE_PARENT_REQUIRED");
  const resolved = await realpath(parent);
  if (resolved !== parent && !isApprovedDarwinSystemAlias(parent, resolved)) scientificCalculationFail("CALCULATION_PARENT_REALPATH_MISMATCH");
  return resolved;
}
async function durableCreate(dir: string, name: string, value: unknown) {
  const handle = await open(path.join(dir, name), constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(`${stableScientificJson(value)}\n`, "utf8"); await handle.sync(); } finally { await handle.close(); }
  const directory = await open(dir, constants.O_RDONLY | constants.O_DIRECTORY);
  try { await directory.sync(); } finally { await directory.close(); }
}

export function validateScientificComputeRuntimeManifest(value: unknown): RuntimeManifest {
  exactKeys(value, ["version", "profileId", "pythonExecutable", "pythonExecutableSha256", "pythonVersion", "scipyVersion", "workerPath", "workerSha256", "maximumInputBytes", "maximumOutputBytes", "defaultTimeoutMs", "maximumTimeoutMs", "operations", "scipyRequiredOperations", "networkIsolation", "shellExecution", "arbitraryCode"], "RUNTIME_MANIFEST");
  if (!isRecord(value) || value.version !== "stage-5e1g-b-runtime-manifest-v1" ||
    typeof value.profileId !== "string" || !path.isAbsolute(String(value.pythonExecutable)) ||
    !isSha256(value.pythonExecutableSha256) || !/^\d+\.\d+\.\d+$/.test(String(value.pythonVersion)) ||
    !/^\d+\.\d+\.\d+$/.test(String(value.scipyVersion)) || typeof value.workerPath !== "string" ||
    path.isAbsolute(value.workerPath as string) || (value.workerPath as string).split(path.sep).includes("..") ||
    !isSha256(value.workerSha256) || !Number.isSafeInteger(value.maximumInputBytes) ||
    !Number.isSafeInteger(value.maximumOutputBytes) || !Number.isSafeInteger(value.defaultTimeoutMs) ||
    !Number.isSafeInteger(value.maximumTimeoutMs) || (value.maximumInputBytes as number) < 1024 ||
    (value.maximumOutputBytes as number) < 1024 || (value.defaultTimeoutMs as number) < 1 ||
    (value.maximumTimeoutMs as number) < (value.defaultTimeoutMs as number) ||
    !Array.isArray(value.operations) || value.operations.length !== 6 || new Set(value.operations).size !== value.operations.length ||
    !Array.isArray(value.scipyRequiredOperations) || value.scipyRequiredOperations.length !== 1 ||
    value.scipyRequiredOperations[0] !== "mean_t_ci_scipy_v1" ||
    value.networkIsolation !== "NOT_OS_ENFORCED" || value.shellExecution !== false || value.arbitraryCode !== false) {
    scientificCalculationFail("CALCULATION_RUNTIME_MANIFEST_INVALID");
  }
  return structuredClone(value) as RuntimeManifest;
}

async function loadPinnedRuntime(): Promise<RuntimeManifest> {
  const runtimeBytes = await readFile(RUNTIME_MANIFEST_PATH);
  if (scientificSha256(runtimeBytes) !== RUNTIME_MANIFEST_SHA256) scientificCalculationFail("CALCULATION_RUNTIME_MANIFEST_IDENTITY_MISMATCH");
  const runtime = validateScientificComputeRuntimeManifest(JSON.parse(runtimeBytes.toString("utf8")));
  const executableStat = await lstat(runtime.pythonExecutable).catch(() => scientificCalculationFail("CALCULATION_PYTHON_UNAVAILABLE"));
  if (!executableStat.isFile() || executableStat.isSymbolicLink() ||
    scientificSha256(await readFile(runtime.pythonExecutable)) !== runtime.pythonExecutableSha256) {
    scientificCalculationFail("CALCULATION_PYTHON_IDENTITY_MISMATCH");
  }
  const workerPath = path.join(REPOSITORY_ROOT, runtime.workerPath);
  const workerStat = await lstat(workerPath).catch(() => scientificCalculationFail("CALCULATION_WORKER_UNAVAILABLE"));
  if (!workerStat.isFile() || workerStat.isSymbolicLink() || scientificSha256(await readFile(workerPath)) !== runtime.workerSha256) {
    scientificCalculationFail("CALCULATION_WORKER_IDENTITY_MISMATCH");
  }
  return runtime;
}

async function executePinnedWorker(
  runtime: RuntimeManifest,
  request: ScientificCalculationRequest,
  timeoutMs: number,
): Promise<{ output: Record<string, unknown>; stdoutSha256: string; stderrSha256: string }> {
  const workerPath = path.join(REPOSITORY_ROOT, runtime.workerPath);
  const workerInput = stableScientificJson({
    workerVersion: "stage-5e1g-b-python-worker-v1",
    expectedPythonVersion: runtime.pythonVersion,
    expectedScipyVersion: runtime.scipyVersion,
    operation: request.operation,
    parameters: request.parameters,
    precision: request.precision.decimalPlaces,
  });
  if (Buffer.byteLength(workerInput) > runtime.maximumInputBytes) scientificCalculationFail("CALCULATION_WORKER_INPUT_TOO_LARGE");
  return await new Promise((resolve, reject) => {
    const child = spawn(runtime.pythonExecutable, ["-I", "-B", workerPath], {
      cwd: REPOSITORY_ROOT,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        NODE_ENV: "test", PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", TZ: "UTC", PYTHONHASHSEED: "0",
        OPENBLAS_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MKL_NUM_THREADS: "1",
      },
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let outputExceeded = false;
    const timer = setTimeout(() => { child.kill("SIGKILL"); }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > runtime.maximumOutputBytes) { outputExceeded = true; child.kill("SIGKILL"); return; }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.length;
      if (stderrBytes > runtime.maximumOutputBytes) { outputExceeded = true; child.kill("SIGKILL"); return; }
      stderr.push(chunk);
    });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const out = Buffer.concat(stdout);
      const err = Buffer.concat(stderr);
      if (outputExceeded) { reject(new Error("STAGE_5E1G_B_CALCULATION_OUTPUT_LIMIT_EXCEEDED")); return; }
      if (signal === "SIGKILL") { reject(new Error("STAGE_5E1G_B_CALCULATION_TIMEOUT")); return; }
      let parsed: unknown;
      try { parsed = JSON.parse(out.toString("utf8")); } catch { reject(new Error("STAGE_5E1G_B_CALCULATION_WORKER_OUTPUT_INVALID")); return; }
      if (code !== 0) {
        const reason = isRecord(parsed) && typeof parsed.error === "string" ? parsed.error : "STAGE_5E1G_B_CALCULATION_WORKER_FAILED";
        reject(new Error(reason)); return;
      }
      if (!isRecord(parsed)) { reject(new Error("STAGE_5E1G_B_CALCULATION_WORKER_OUTPUT_INVALID")); return; }
      resolve({ output: parsed, stdoutSha256: scientificSha256(out), stderrSha256: scientificSha256(err) });
    });
    child.stdin.end(workerInput);
  });
}

function validateWorkerOutput(output: Record<string, unknown>, request: ScientificCalculationRequest) {
  exactKeys(output, ["workerVersion", "pythonVersion", "operation", "result", "resultSha256", "limitations", "reproducibility"], "WORKER_OUTPUT");
  if (output.workerVersion !== "stage-5e1g-b-python-worker-v1" || output.operation !== request.operation ||
    !isRecord(output.result) || !isSha256(output.resultSha256) ||
    !Array.isArray(output.limitations) || !output.limitations.every((item) => typeof item === "string" && item.length > 0) ||
    output.reproducibility !== "TOLERANCE_BOUNDED_DETERMINISTIC_ALGORITHM") {
    scientificCalculationFail("CALCULATION_WORKER_RECEIPT_INVALID");
  }
}

export async function runScientificCalculation(
  requestValue: unknown,
  options: Readonly<{ runDirectory: string; timeoutMs?: number }>,
): Promise<ScientificCalculationReceipt> {
  const request = validateScientificCalculationRequest(requestValue);
  const runtime = await loadPinnedRuntime();
  if (!runtime.operations.includes(request.operation)) scientificCalculationFail("CALCULATION_OPERATION_NOT_PINNED");
  const timeoutMs = options.timeoutMs ?? runtime.defaultTimeoutMs;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > runtime.maximumTimeoutMs) {
    scientificCalculationFail("CALCULATION_TIMEOUT_POLICY_INVALID");
  }
  const parent = await privateCanonicalParent(options.runDirectory);
  const runDirectory = path.join(parent, path.basename(options.runDirectory));
  try { await mkdir(runDirectory, { mode: 0o700 }); } catch { scientificCalculationFail("CALCULATION_RUN_ALREADY_EXISTS_OR_UNAVAILABLE"); }
  await durableCreate(runDirectory, "request.json", request);
  await durableCreate(runDirectory, "attempt-0001-consumed.json", {
    version: "stage-5e1g-b-calculation-attempt-v1", operationId: request.operationId,
    requestIdentitySha256: request.requestIdentitySha256, ordinal: 1,
    state: "authorization_consumed_before_trusted_worker_dispatch", automaticRetry: false,
  });
  try {
    if (runtime.scipyRequiredOperations.includes(request.operation)) {
      // A SciPy calculation is authorized only by the separate digest-pinned,
      // container-isolated runtime. Readiness is checked after durable attempt
      // consumption so an unavailable or ambiguous dispatch is never replayed.
      await assertScientificContainerRuntimeReady();
      scientificCalculationFail("CONTAINER_EXECUTION_NOT_IMPLEMENTED");
    }
    const execution = await executePinnedWorker(runtime, request, timeoutMs);
    validateWorkerOutput(execution.output, request);
    const result = execution.output.result as Readonly<Record<string, unknown>>;
    const limitations = [...request.limitations, ...(execution.output.limitations as string[]),
      "SOURCE_AUTHENTICITY_NOT_ESTABLISHED_BY_CALCULATION",
      "SCIENTIFIC_INTERPRETATION_REQUIRES_QUALIFIED_HUMAN_REVIEW",
      "NETWORK_ISOLATION_NOT_OS_ENFORCED"];
    const receipt: ScientificCalculationReceipt = {
      version: SCIENTIFIC_CALCULATION_RECEIPT_VERSION,
      operationId: request.operationId, operation: request.operation, method: request.method,
      authority: "COMPUTED_NUMERICAL_RESULT_ONLY", requestIdentitySha256: request.requestIdentitySha256,
      inputDataSha256: request.inputDataSha256,
      sourceBindingSetSha256: scientificSha256(stableScientificJson(request.sourceBindings)),
      runtime: { profileId: runtime.profileId, pythonVersion: runtime.pythonVersion,
        scipyVersion: runtime.scipyRequiredOperations.includes(request.operation) ? runtime.scipyVersion : "NOT_USED_BY_METHOD",
        pythonExecutableSha256: runtime.pythonExecutableSha256, workerSha256: runtime.workerSha256,
        networkIsolation: "NOT_OS_ENFORCED" },
      precision: request.precision, numericalResult: structuredClone(result),
      numericalResultSha256: scientificSha256(stableScientificJson(result)),
      limitations, reproducibility: "TOLERANCE_BOUNDED_DETERMINISTIC_ALGORITHM",
      attemptOrdinal: 1, sourceAuthenticityEstablished: false, scientificInterpretationEstablished: false,
      qualifiedHumanApproval: false, liveAuthorization: false,
    };
    await durableCreate(runDirectory, "receipt.json", receipt);
    await durableCreate(runDirectory, "audit.json", {
      version: "stage-5e1g-b-calculation-audit-v1", operationId: request.operationId,
      requestIdentitySha256: request.requestIdentitySha256, inputDataSha256: request.inputDataSha256,
      numericalResultSha256: receipt.numericalResultSha256,
      workerReportedResultSha256: execution.output.resultSha256,
      stdoutSha256: execution.stdoutSha256, stderrSha256: execution.stderrSha256,
      authority: "COMPUTED_NUMERICAL_RESULT_ONLY", liveDisposition: "NO_GO",
      privacy: { rawSourceText: false, credentials: false, providerData: false },
    });
    return receipt;
  } catch (error) {
    const reason = error instanceof Error && /^STAGE_5E1G_[AB]_[A-Z0-9_]+$/.test(error.message)
      ? error.message : "STAGE_5E1G_B_CALCULATION_EXECUTION_FAILED";
    await durableCreate(runDirectory, "failure.json", {
      version: "stage-5e1g-b-calculation-failure-v1", operationId: request.operationId,
      requestIdentitySha256: request.requestIdentitySha256, attemptOrdinal: 1,
      state: "TERMINAL_NO_AUTOMATIC_RETRY", reason, liveDisposition: "NO_GO",
    });
    throw error;
  }
}
