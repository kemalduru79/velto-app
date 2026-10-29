import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scientificSha256 } from "./authorityContracts.ts";
import { scientificCalculationFail } from "./calculationContracts.ts";

export const SCIENTIFIC_CONTAINER_RUNTIME_VERSION = "stage-5e1g-b-container-runtime-v1" as const;

type ContainerImageAuthority = Readonly<{
  reference: string | null;
  imageId: string | null;
  repoDigest: string | null;
}>;

export type ScientificContainerRuntimeManifest = Readonly<{
  version: typeof SCIENTIFIC_CONTAINER_RUNTIME_VERSION;
  status: "READY" | "BLOCKED_UNPROVISIONED";
  blockerCodes: readonly string[];
  engine: Readonly<{
    executable: string;
    executableSha256: string;
    version: string;
  }>;
  hostArchitecture: "arm64" | "x64";
  targetPlatform: "linux/arm64" | "linux/amd64";
  image: ContainerImageAuthority;
  dependencies: Readonly<{
    python: string | null;
    pythonExecutable: string | null;
    pythonExecutableSha256: string | null;
    numpy: string | null;
    numpyDistributionSha256: string | null;
    scipy: string | null;
    scipyDistributionSha256: string | null;
  }>;
  worker: Readonly<{
    containerPath: string;
    sha256: string;
  }>;
  limits: Readonly<{
    cpus: number;
    memoryBytes: number;
    pids: number;
    tmpfsBytes: number;
    timeoutMs: number;
    maximumInputBytes: number;
    maximumOutputBytes: number;
  }>;
  isolation: Readonly<{
    network: "none";
    readOnlyRoot: true;
    user: "65532:65532";
    noNewPrivileges: true;
    dropCapabilities: "ALL";
    pullPolicy: "never";
    mounts: "NONE";
    tmpfsOptions: "rw,noexec,nosuid,nodev";
  }>;
}>;

export type ScientificContainerInvocation = Readonly<{
  executable: string;
  args: readonly string[];
  stdinLimitBytes: number;
  stdoutLimitBytes: number;
  timeoutMs: number;
  imageDigest: string;
}>;

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(MODULE_DIRECTORY, "scientificComputeContainerRuntime.v1.json");
const MANIFEST_SHA256 = "740697224fa40e2fb5ae307cc7873b462a479c9879ae38f5a2c6e6544ed98283";
const SHA256 = /^[a-f0-9]{64}$/;
const DIGEST_REFERENCE = /^[a-z0-9][a-z0-9._/-]*(?::[a-zA-Z0-9._-]+)?@sha256:([a-f0-9]{64})$/;
const IMAGE_ID = /^sha256:[a-f0-9]{64}$/;
const BLOCKER_CODE = /^[A-Z][A-Z0-9_]{2,99}$/;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: unknown, keys: readonly string[], label: string): asserts value is Record<string, unknown> {
  if (!record(value) || Object.keys(value).some((key) => !keys.includes(key)) || keys.some((key) => !(key in value))) {
    scientificCalculationFail(`CONTAINER_${label}_SCHEMA_INVALID`);
  }
}

function positiveInteger(value: unknown, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= maximum;
}

function validateImageAuthority(value: unknown, ready: boolean): ContainerImageAuthority {
  exactKeys(value, ["reference", "imageId", "repoDigest"], "IMAGE");
  if (!ready) {
    if (value.reference !== null || value.imageId !== null || value.repoDigest !== null) {
      scientificCalculationFail("CONTAINER_UNVERIFIED_IMAGE_AUTHORITY_PRESENT");
    }
    return { reference: null, imageId: null, repoDigest: null };
  }
  if (typeof value.reference !== "string" || typeof value.imageId !== "string" || typeof value.repoDigest !== "string") {
    scientificCalculationFail("CONTAINER_IMAGE_AUTHORITY_MISSING");
  }
  const referenceMatch = DIGEST_REFERENCE.exec(value.reference);
  const repoMatch = DIGEST_REFERENCE.exec(value.repoDigest);
  if (!referenceMatch || !repoMatch || !IMAGE_ID.test(value.imageId) || referenceMatch[1] !== repoMatch[1]) {
    scientificCalculationFail("CONTAINER_IMAGE_IDENTITY_INVALID");
  }
  return { reference: value.reference, imageId: value.imageId, repoDigest: value.repoDigest };
}

export function validateScientificContainerRuntimeManifest(value: unknown): ScientificContainerRuntimeManifest {
  exactKeys(value, ["version", "status", "blockerCodes", "engine", "hostArchitecture", "targetPlatform", "image", "dependencies", "worker", "limits", "isolation"], "RUNTIME_MANIFEST");
  if (value.version !== SCIENTIFIC_CONTAINER_RUNTIME_VERSION ||
    (value.status !== "READY" && value.status !== "BLOCKED_UNPROVISIONED") ||
    !Array.isArray(value.blockerCodes) || !value.blockerCodes.every((item) => typeof item === "string" && BLOCKER_CODE.test(item)) ||
    new Set(value.blockerCodes).size !== value.blockerCodes.length) {
    scientificCalculationFail("CONTAINER_RUNTIME_MANIFEST_INVALID");
  }
  const ready = value.status === "READY";
  if ((ready && value.blockerCodes.length !== 0) || (!ready && value.blockerCodes.length === 0)) {
    scientificCalculationFail("CONTAINER_READINESS_CONTRADICTION");
  }

  exactKeys(value.engine, ["executable", "executableSha256", "version"], "ENGINE");
  if (typeof value.engine.executable !== "string" || !path.isAbsolute(value.engine.executable) ||
    typeof value.engine.executableSha256 !== "string" || !SHA256.test(value.engine.executableSha256) ||
    typeof value.engine.version !== "string" || !/^\d+\.\d+\.\d+$/.test(value.engine.version)) {
    scientificCalculationFail("CONTAINER_ENGINE_IDENTITY_INVALID");
  }
  if ((value.hostArchitecture !== "arm64" && value.hostArchitecture !== "x64") ||
    (value.targetPlatform !== "linux/arm64" && value.targetPlatform !== "linux/amd64") ||
    (value.hostArchitecture === "arm64" ? value.targetPlatform !== "linux/arm64" : value.targetPlatform !== "linux/amd64")) {
    scientificCalculationFail("CONTAINER_PLATFORM_INVALID");
  }
  const image = validateImageAuthority(value.image, ready);

  exactKeys(value.dependencies, ["python", "pythonExecutable", "pythonExecutableSha256", "numpy", "numpyDistributionSha256", "scipy", "scipyDistributionSha256"], "DEPENDENCIES");
  for (const dependency of [value.dependencies.python, value.dependencies.numpy, value.dependencies.scipy]) {
    if (ready ? typeof dependency !== "string" || !/^\d+\.\d+\.\d+$/.test(dependency) : dependency !== null) {
      scientificCalculationFail("CONTAINER_DEPENDENCY_AUTHORITY_INVALID");
    }
  }
  const dependencyHashes = [value.dependencies.pythonExecutableSha256, value.dependencies.numpyDistributionSha256, value.dependencies.scipyDistributionSha256];
  if (ready) {
    if (typeof value.dependencies.pythonExecutable !== "string" || !value.dependencies.pythonExecutable.startsWith("/usr/local/") ||
      value.dependencies.pythonExecutable.includes("..") || !dependencyHashes.every((digest) => typeof digest === "string" && SHA256.test(digest))) {
      scientificCalculationFail("CONTAINER_DEPENDENCY_IDENTITY_INVALID");
    }
  } else if (value.dependencies.pythonExecutable !== null || dependencyHashes.some((digest) => digest !== null)) {
    scientificCalculationFail("CONTAINER_UNVERIFIED_DEPENDENCY_IDENTITY_PRESENT");
  }
  exactKeys(value.worker, ["containerPath", "sha256"], "WORKER");
  if (typeof value.worker.containerPath !== "string" || !value.worker.containerPath.startsWith("/opt/velto/") ||
    value.worker.containerPath.includes("..") || typeof value.worker.sha256 !== "string" || !SHA256.test(value.worker.sha256)) {
    scientificCalculationFail("CONTAINER_WORKER_IDENTITY_INVALID");
  }
  exactKeys(value.limits, ["cpus", "memoryBytes", "pids", "tmpfsBytes", "timeoutMs", "maximumInputBytes", "maximumOutputBytes"], "LIMITS");
  if (typeof value.limits.cpus !== "number" || value.limits.cpus <= 0 || value.limits.cpus > 2 ||
    !positiveInteger(value.limits.memoryBytes, 1_073_741_824) || !positiveInteger(value.limits.pids, 128) ||
    !positiveInteger(value.limits.tmpfsBytes, 134_217_728) || !positiveInteger(value.limits.timeoutMs, 30_000) ||
    !positiveInteger(value.limits.maximumInputBytes, 1_000_000) || !positiveInteger(value.limits.maximumOutputBytes, 1_000_000)) {
    scientificCalculationFail("CONTAINER_LIMITS_INVALID");
  }
  exactKeys(value.isolation, ["network", "readOnlyRoot", "user", "noNewPrivileges", "dropCapabilities", "pullPolicy", "mounts", "tmpfsOptions"], "ISOLATION");
  if (value.isolation.network !== "none" || value.isolation.readOnlyRoot !== true || value.isolation.user !== "65532:65532" ||
    value.isolation.noNewPrivileges !== true || value.isolation.dropCapabilities !== "ALL" ||
    value.isolation.pullPolicy !== "never" || value.isolation.mounts !== "NONE" ||
    value.isolation.tmpfsOptions !== "rw,noexec,nosuid,nodev") {
    scientificCalculationFail("CONTAINER_ISOLATION_POLICY_INVALID");
  }

  return structuredClone({ ...value, image }) as ScientificContainerRuntimeManifest;
}

export async function loadScientificContainerRuntimeManifest(): Promise<ScientificContainerRuntimeManifest> {
  const bytes = await readFile(MANIFEST_PATH);
  if (scientificSha256(bytes) !== MANIFEST_SHA256) scientificCalculationFail("CONTAINER_RUNTIME_MANIFEST_IDENTITY_MISMATCH");
  const manifest = validateScientificContainerRuntimeManifest(JSON.parse(bytes.toString("utf8")));
  const executableStat = await lstat(manifest.engine.executable).catch(() => scientificCalculationFail("CONTAINER_ENGINE_UNAVAILABLE"));
  if (!executableStat.isFile() || executableStat.isSymbolicLink() ||
    scientificSha256(await readFile(manifest.engine.executable)) !== manifest.engine.executableSha256) {
    scientificCalculationFail("CONTAINER_ENGINE_IDENTITY_MISMATCH");
  }
  const resolved = await realpath(manifest.engine.executable);
  if (resolved !== manifest.engine.executable) scientificCalculationFail("CONTAINER_ENGINE_REALPATH_MISMATCH");
  return manifest;
}

export function buildScientificContainerInvocation(manifestValue: unknown): ScientificContainerInvocation {
  const manifest = validateScientificContainerRuntimeManifest(manifestValue);
  if (manifest.status !== "READY" || !manifest.image.reference || !manifest.image.repoDigest) {
    scientificCalculationFail("CONTAINER_RUNTIME_NOT_PROVISIONED");
  }
  const memory = String(manifest.limits.memoryBytes);
  const tmpfs = `/tmp:${manifest.isolation.tmpfsOptions},size=${manifest.limits.tmpfsBytes},mode=1777`;
  const args = [
    "run", "--rm", "--pull", manifest.isolation.pullPolicy,
    "--platform", manifest.targetPlatform,
    "--network", manifest.isolation.network,
    "--read-only",
    "--user", manifest.isolation.user,
    "--security-opt", "no-new-privileges=true",
    "--cap-drop", manifest.isolation.dropCapabilities,
    "--cpus", String(manifest.limits.cpus),
    "--memory", memory,
    "--memory-swap", memory,
    "--pids-limit", String(manifest.limits.pids),
    "--tmpfs", tmpfs,
    "--env", "LANG=C.UTF-8", "--env", "LC_ALL=C.UTF-8", "--env", "TZ=UTC",
    "--env", "PYTHONHASHSEED=0", "--env", "OPENBLAS_NUM_THREADS=1", "--env", "OMP_NUM_THREADS=1",
    "--entrypoint", manifest.dependencies.pythonExecutable as string,
    manifest.image.reference,
    "-I", "-B", manifest.worker.containerPath,
  ] as const;
  if (args.some((argument) => argument.includes("\n") || argument.includes("\0")) || args.includes("--mount") || args.includes("--volume")) {
    scientificCalculationFail("CONTAINER_INVOCATION_UNSAFE");
  }
  return {
    executable: manifest.engine.executable,
    args,
    stdinLimitBytes: manifest.limits.maximumInputBytes,
    stdoutLimitBytes: manifest.limits.maximumOutputBytes,
    timeoutMs: manifest.limits.timeoutMs,
    imageDigest: manifest.image.repoDigest,
  };
}

export async function assertScientificContainerRuntimeReady(): Promise<ScientificContainerInvocation> {
  const manifest = await loadScientificContainerRuntimeManifest();
  return buildScientificContainerInvocation(manifest);
}
