/** OFFLINE CONTROL-FLOW MODEL ONLY. No subprocess, Docker, network or real transport is implemented. */
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { scientificSha256, stableScientificJson } from "./authorityContracts.ts";
import { validateScientificCalculationRequest } from "./calculationContracts.ts";
import {
  SCIENTIFIC_V2_BYTE_LIMIT, SCIENTIFIC_V2_PROTOCOL, sealScientificV2Receipt,
  validateScientificV2Profile, validateScientificV2Result, v2Fail, exactV2,
} from "./runtimeV2Contracts.ts";
import type { ScientificV2Profile, ScientificV2Receipt } from "./runtimeV2Contracts.ts";

const monotonicNow = performance.now.bind(performance);
// Capture native metadata accessors: instance byteLength/length/buffer/offset and
// iterators are caller-controlled. Shared/resizable backing stores are rejected.
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const viewByteLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, "byteLength")!.get!;
const viewByteOffset = Object.getOwnPropertyDescriptor(typedArrayPrototype, "byteOffset")!.get!;
const viewBuffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, "buffer")!.get!;
const viewKind = Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag)!.get!;
const arrayBufferByteLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")!.get!;
const arrayBufferResizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")?.get;
const NativeUint8Array = Uint8Array;
const copyBytes = Uint8Array.prototype.set;
const allocateBytes = Buffer.allocUnsafe;

export type SyntheticV2Invocation = Readonly<{
  mode: "OFFLINE_SYNTHETIC"; executable: string; args: readonly string[]; env: Readonly<Record<string, string>>;
  stdin: Uint8Array; timeoutMs: number; maximumOutputBytes: number; ownedName: string;
}>;
export type SyntheticV2Exit = Readonly<{
  ownedName: string; containerId: string; exitCode: number;
  observed: { profileSha256: string; engineSha256: string; daemonIdentitySha256: string; imageManifestSha256: string; indexSha256: string; imageConfigSha256: string; workerSha256: string; pythonSha256: string; inventorySha256: string; blasSha256: string; isolationAcceptanceSha256: string; supervisorSha256: string };
}>;
export type SyntheticV2CleanupPlan = Readonly<{
  ownedName: string; containerId: string | null; requireOwnershipBeforeMutation: true;
  expectedImageConfigSha256: string; expectedProfileSha256: string;
  commands: ReadonlyArray<{ action: "inspect" | "kill" | "remove"; executable: string; args: readonly string[] }>;
}>;
export type SyntheticV2Cleanup = Readonly<{ ownedName: string; containerId: string | null; creationSettled: true; containerAbsent: true }>;
/** Test doubles only. This interface is NOT qualification or an execution capability. */
export type OfflineScientificV2Transport = Readonly<{
  mode: "OFFLINE_SYNTHETIC";
  execute: (invocation: SyntheticV2Invocation, events: { signal: AbortSignal; stdout: (chunk: Uint8Array) => void; stderr: (chunk: Uint8Array) => void }) => Promise<SyntheticV2Exit>;
  reconcile: (identity: SyntheticV2CleanupPlan, signal: AbortSignal) => Promise<SyntheticV2Cleanup>;
}>;

const SAFE_EXECUTION_FAILURES = new Set([
  "EXECUTION_IDENTITY_OR_EXIT_INVALID", "OBSERVED_IDENTITY_MISMATCH", "SCHEMA_INVALID", "OUTPUT_IDENTITY_MISMATCH",
  "NUMERIC_DOMAIN_INVALID", "RESULT_INVALID", "IDENTITY_INVALID", "RESULT_DIGEST_MISMATCH", "RESULT_CONSISTENCY_MISMATCH", "RESULT_COUNT_MISMATCH",
  "RESULT_CONFIDENCE_MISMATCH", "RESULT_NOT_CANONICAL", "JSON_INVALID", "JSON_DUPLICATE_KEY", "JSON_DEPTH_EXCEEDED", "OUTPUT_LIMIT_EXCEEDED",
].map(code => `SCIENTIFIC_V2_${code}`));

/** No path-based substitute is safe against ancestor replacement. Node's portable
 * fs API has no openat/mkdirat capability. No persistence provider is installed.
 * A reviewed directory-relative provider is required before durable admission.
 */
export async function runOfflineScientificV2(
  _requestValue: unknown,
  _options: ScientificV2OfflineOptions,
  _transport: OfflineScientificV2Transport,
): Promise<ScientificV2Receipt> {
  return v2Fail("DIRECTORY_RELATIVE_PERSISTENCE_UNAVAILABLE");
}

type ScientificV2OfflineOptions = {
  profile: unknown; expectedProfileSha256: string; runDirectory: string;
  timeoutMs?: number; cleanupTimeoutMs?: number; signal?: AbortSignal;
};
/** Synthetic storage double ONLY. Not a durable admission or filesystem API. */
export type ScientificV2StorageModel = Readonly<{
  mode: "VOLATILE_SYNTHETIC_STORAGE";
  admit: (identity: string) => Promise<{ create: (name: string, value: unknown) => Promise<void> }>;
}>;
export const SCIENTIFIC_V2_CHUNK_LIMIT = 4096;

function timeoutPolicy(value: unknown, maximum: number, fallback: number): number {
  const timeout = value ?? fallback;
  if (!Number.isSafeInteger(timeout) || (timeout as number) < 1 || (timeout as number) > maximum) v2Fail("TIMEOUT_POLICY_INVALID");
  return timeout as number;
}
function makeInvocation(profile: ScientificV2Profile, stdin: Uint8Array, ownedName: string, timeoutMs: number): SyntheticV2Invocation {
  return {
    mode: "OFFLINE_SYNTHETIC", executable: profile.engine.executable, ownedName, stdin: Uint8Array.from(stdin), timeoutMs, maximumOutputBytes: SCIENTIFIC_V2_BYTE_LIMIT,
    args: ["--host", `unix://${profile.engine.socketPath}`, "--config", profile.engine.configDirectory,
      "run", "--interactive", "--rm", "--name", ownedName, "--label", `velto.scientific.attempt=${ownedName}`, "--pull", "never", "--platform", profile.platform,
      "--network", "none", "--read-only", "--user", "65532:65532", "--security-opt", "no-new-privileges=true",
      "--cap-drop", "ALL", "--cpus", "1", "--memory", "536870912", "--memory-swap", "536870912", "--pids-limit", "64",
      "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=67108864,mode=1777",
      "--env", "LANG=C.UTF-8", "--env", "LC_ALL=C.UTF-8", "--env", "TZ=UTC", "--env", "PYTHONHASHSEED=0",
      "--env", "OPENBLAS_NUM_THREADS=1", "--env", "OMP_NUM_THREADS=1", "--env", "MKL_NUM_THREADS=1",
      "--entrypoint", profile.dependencies.pythonExecutable, profile.image.reference, "-I", "-B", profile.worker.path],
    env: { PATH: "/usr/bin:/bin", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC" },
  };
}
function cleanupPlan(profile: ScientificV2Profile, profileSha256: string, ownedName: string, containerId: string | null): SyntheticV2CleanupPlan {
  // Prepared argv only. A future qualified supervisor must inspect the name,
  // attempt label, CID and image before mutation, and settle pending creation.
  const base = ["--host", `unix://${profile.engine.socketPath}`, "--config", profile.engine.configDirectory, "container"];
  return { ownedName, containerId, requireOwnershipBeforeMutation: true, expectedImageConfigSha256: profile.image.configSha256, expectedProfileSha256: profileSha256,
    commands: [
      { action: "inspect", executable: profile.engine.executable, args: [...base, "inspect", ownedName] },
      { action: "kill", executable: profile.engine.executable, args: [...base, "kill", ownedName] },
      { action: "remove", executable: profile.engine.executable, args: [...base, "rm", "--force", ownedName] },
    ] };
}
function verifyExit(exit: SyntheticV2Exit, profile: ScientificV2Profile, profileSha256: string, ownedName: string) {
  exactV2(exit, ["ownedName", "containerId", "exitCode", "observed"]);
  if (exit?.ownedName !== ownedName || !/^[a-f0-9]{64}$/.test(exit?.containerId) || exit.exitCode !== 0) v2Fail("EXECUTION_IDENTITY_OR_EXIT_INVALID");
  const expected = { profileSha256, engineSha256: profile.engine.executableSha256, daemonIdentitySha256: profile.engine.daemonIdentitySha256,
    imageManifestSha256: profile.image.manifestSha256, indexSha256: profile.image.indexSha256, imageConfigSha256: profile.image.configSha256, workerSha256: profile.worker.sha256, pythonSha256: profile.dependencies.pythonSha256,
    inventorySha256: profile.dependencies.inventorySha256, blasSha256: profile.dependencies.blasSha256,
    isolationAcceptanceSha256: profile.evidence.isolationAcceptanceSha256, supervisorSha256: profile.engine.supervisorSha256 };
  if (stableScientificJson(exit.observed) !== stableScientificJson(expected)) v2Fail("OBSERVED_IDENTITY_MISMATCH");
}

/**
 * Volatile synthetic-storage lifecycle exercise, NOT durable runtime admission. Even a successful receipt explicitly denies
 * runtime qualification. Production executeScientificContainerV2 always throws.
 */
export async function modelOfflineScientificV2(
  requestValue: unknown,
  options: ScientificV2OfflineOptions,
  transport: OfflineScientificV2Transport,
  storage: ScientificV2StorageModel,
): Promise<ScientificV2Receipt> {
  // Snapshot caller-owned values/capabilities before the first await. The model
  // never uses a caller-controlled filesystem path for persistence.
  const { profile: profileValue, expectedProfileSha256, runDirectory, timeoutMs: requestedTimeout, cleanupTimeoutMs: requestedCleanupTimeout, signal } = options;
  const execute = transport?.execute?.bind(transport), reconcile = transport?.reconcile?.bind(transport);
  const admit = storage?.admit?.bind(storage);
  if (storage?.mode !== "VOLATILE_SYNTHETIC_STORAGE" || !admit) v2Fail("SYNTHETIC_STORAGE_REQUIRED");
  if (transport?.mode !== "OFFLINE_SYNTHETIC" || !execute || !reconcile) v2Fail("REAL_EXECUTION_DISABLED");
  const request = validateScientificCalculationRequest(requestValue);
  const profile = validateScientificV2Profile(profileValue, expectedProfileSha256);
  const profileSha256 = expectedProfileSha256;
  const timeoutMs = timeoutPolicy(requestedTimeout, 5000, 2000);
  const cleanupTimeoutMs = timeoutPolicy(requestedCleanupTimeout, 2000, 1000);
  const stdin = Buffer.from(stableScientificJson({ protocol: SCIENTIFIC_V2_PROTOCOL, request, profileSha256 }), "utf8");
  if (stdin.byteLength > SCIENTIFIC_V2_BYTE_LIMIT) v2Fail("INPUT_LIMIT_EXCEEDED");
  if (signal?.aborted) v2Fail("INTERRUPTED_BEFORE_ADMISSION");
  const admitted = await admit(runDirectory);
  const create = admitted.create.bind(admitted);
  const attemptId = randomUUID();
  const ownedName = `velto-scientific-v2-${scientificSha256(attemptId).slice(0, 32)}`;
  await create("request.json", request);
  await create("attempt-0001-consumed.json", { version: "scientific-attempt-v2", attemptId, ownedName,
    requestIdentitySha256: request.requestIdentitySha256, profileSha256, stdinSha256: scientificSha256(stdin), ordinal: 1,
    state: "CONSUMED_BEFORE_SYNTHETIC_DISPATCH", executionMode: "OFFLINE_SYNTHETIC", automaticRetry: false });

  const controller = new AbortController();
  let terminal: string | null = null;
  let ended = false;
  let cancel!: () => void;
  const cancelled = new Promise<never>((_, reject) => { cancel = () => reject(new Error("SCIENTIFIC_V2_TERMINAL")); });
  // A cancellation before dispatch is still recorded below; consume its rejection.
  void cancelled.catch(() => undefined);
  const fail = (reason: string) => { if (!terminal) { terminal = reason; controller.abort(); cancel(); } };
  const onAbort = () => fail("INTERRUPTED");
  signal?.addEventListener("abort", onAbort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stdout: Buffer[] = [], stderr: Buffer[] = [];
  let outBytes = 0, errBytes = 0;
  const collect = (channel: "stdout" | "stderr", chunk: Uint8Array) => {
    if (ended || terminal) return;
    let length: number, offset: number, backing: ArrayBuffer;
    try {
      if (viewKind.call(chunk) !== "Uint8Array") throw new Error();
      length = viewByteLength.call(chunk); offset = viewByteOffset.call(chunk); backing = viewBuffer.call(chunk);
      arrayBufferByteLength.call(backing); // Reject SharedArrayBuffer/non-ArrayBuffer stores by intrinsic brand.
      if (arrayBufferResizable?.call(backing)) throw new Error();
    } catch { fail("OUTPUT_INVALID"); return; }
    // Enforce the actual remaining budget BEFORE payload allocation or copying.
    const bytes = channel === "stdout" ? outBytes : errBytes;
    if (length > SCIENTIFIC_V2_BYTE_LIMIT - bytes) { fail("OUTPUT_LIMIT_EXCEEDED"); return; }
    const chunks = channel === "stdout" ? stdout : stderr;
    if (length > 0 && chunks.length >= SCIENTIFIC_V2_CHUNK_LIMIT) { fail("OUTPUT_CHUNK_LIMIT_EXCEEDED"); return; }
    try {
      // A native view also rejects detached stores, including zero-length ones.
      const view = new NativeUint8Array(backing, offset, length);
      if (length === 0) return;
      const copy = allocateBytes(length);
      copyBytes.call(copy, view); // TypedArray-to-TypedArray copy ignores instance length/iterators.
      chunks.push(copy);
    } catch { fail("OUTPUT_INVALID"); return; }
    if (channel === "stdout") outBytes += length; else errBytes += length;
  };
  let exit: SyntheticV2Exit | null = null;
  let result: ReturnType<typeof validateScientificV2Result> | null = null;
  let containerId: string | null = null;
  const executionDeadline = monotonicNow() + timeoutMs;
  const checkExecutionDeadline = () => { if (monotonicNow() >= executionDeadline) fail("TIMEOUT"); };
  try {
    timer = setTimeout(() => fail("TIMEOUT"), timeoutMs);
    // Re-check after asynchronous modeled admission; an interrupt must not slip between them.
    if (signal?.aborted) fail("INTERRUPTED");
    if (!terminal) {
      exit = await Promise.race([Promise.resolve().then(() => {
        if (controller.signal.aborted) return v2Fail("INTERRUPTED");
        return execute(makeInvocation(profile, stdin, ownedName, timeoutMs), {
        signal: controller.signal, stdout: chunk => collect("stdout", chunk), stderr: chunk => collect("stderr", chunk),
      }); }), cancelled]);
      checkExecutionDeadline();
      if (!terminal) {
        verifyExit(exit, profile, profileSha256, ownedName);
        containerId = exit.containerId;
        result = validateScientificV2Result(Buffer.concat(stdout), request, profile, profileSha256);
        checkExecutionDeadline();
      }
    }
  } catch (error) {
    checkExecutionDeadline();
    if (!terminal) terminal = error instanceof Error && SAFE_EXECUTION_FAILURES.has(error.message)
      ? error.message.slice("SCIENTIFIC_V2_".length) : "EXECUTION_INTERRUPTED_OR_FAILED";
  } finally {
    checkExecutionDeadline();
    ended = true; controller.abort(); if (timer) clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
    checkExecutionDeadline();
  }
  // Always reconcile the generated owned name, never a foreign name from output.
  const cleanupController = new AbortController();
  let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
  let reconciled = false;
  const cleanupDeadline = monotonicNow() + cleanupTimeoutMs;
  try {
    const timeout = new Promise<never>((_, reject) => { cleanupTimer = setTimeout(() => { cleanupController.abort(); reject(new Error("CLEANUP_TIMEOUT")); }, cleanupTimeoutMs); });
    const cleanup = await Promise.race([Promise.resolve().then(() => reconcile(cleanupPlan(profile, profileSha256, ownedName, containerId), cleanupController.signal)), timeout]);
    exactV2(cleanup, ["ownedName", "containerId", "creationSettled", "containerAbsent"]);
    reconciled = monotonicNow() < cleanupDeadline && cleanup?.ownedName === ownedName && cleanup.creationSettled === true && cleanup.containerAbsent === true && cleanup.containerId === containerId;
  } catch { reconciled = false; }
  finally { cleanupController.abort(); if (cleanupTimer) clearTimeout(cleanupTimer); if (monotonicNow() >= cleanupDeadline) reconciled = false; }
  await create("reconciliation.json", { executionMode: "OFFLINE_SYNTHETIC", attemptId, ownedName, containerId,
    creationSettledAndAbsent: reconciled, status: reconciled ? "RECONCILED" : "RECONCILIATION_REQUIRED", automaticRetry: false });
  if (!reconciled || terminal || !result || !exit || !containerId) {
    const reason = !reconciled ? "RECONCILIATION_REQUIRED" : terminal || "EXECUTION_FAILED";
    await create("failure.json", { executionMode: "OFFLINE_SYNTHETIC", attemptId, ownedName, containerId,
      requestIdentitySha256: request.requestIdentitySha256, reason, executionReason: terminal, state: "TERMINAL_NO_AUTOMATIC_RETRY", automaticRetry: false });
    return v2Fail(reason);
  }
  const receipt = sealScientificV2Receipt({ version: "scientific-calculation-receipt-v2", executionMode: "OFFLINE_SYNTHETIC", persistence: "VOLATILE_SYNTHETIC_ONLY", qualification: "NOT_ESTABLISHED",
    authority: "COMPUTED_NUMERICAL_RESULT_ONLY", requestIdentitySha256: request.requestIdentitySha256, inputDataSha256: request.inputDataSha256,
    sourceBindingSetSha256: scientificSha256(stableScientificJson(request.sourceBindings)), operation: request.operation, method: request.method, precision: request.precision,
    runtime: profile, profileSha256, result, stdinSha256: scientificSha256(stdin), stderrSha256: scientificSha256(Buffer.concat(stderr)),
    lifecycle: { attemptId, ownedName, containerId, ordinal: 1, state: "RECONCILED", automaticRetry: false },
    sourceAuthenticityEstablished: false, scientificInterpretationEstablished: false, qualifiedHumanApproval: false, liveAuthorization: false });
  await create("receipt.json", receipt);
  return receipt;
}
