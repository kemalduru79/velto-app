import { scientificSha256, stableScientificJson } from "./authorityContracts.ts";
import { validateScientificCalculationRequest } from "./calculationContracts.ts";
import type { ScientificCalculationRequest } from "./calculationContracts.ts";

export const SCIENTIFIC_V2_BYTE_LIMIT = 1_000_000;
export const SCIENTIFIC_V2_PROTOCOL = "scientific-result-v2" as const;
export const SCIENTIFIC_V2_PROFILE_IDS = ["linux-amd64-scientific-container-v2", "linux-arm64-scientific-container-v2"] as const;
export type ScientificV2ProfileId = (typeof SCIENTIFIC_V2_PROFILE_IDS)[number];
export function v2Fail(code: string): never { throw new Error(`SCIENTIFIC_V2_${code}`); }
export function exactV2(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) v2Fail("SCHEMA_INVALID");
}
export function v2Hash(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) v2Fail("IDENTITY_INVALID");
}
function absolute(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^\/[A-Za-z0-9._/-]+$/.test(value) || value.includes("//") || value.split("/").some(part => part === "." || part === "..")) v2Fail("PATH_INVALID");
}
function version(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^\d+\.\d+\.\d+$/.test(value)) v2Fail("VERSION_INVALID");
}
export type ScientificV2Profile = Readonly<{
  version: "scientific-runtime-profile-v2";
  profileId: ScientificV2ProfileId;
  platform: "linux/amd64" | "linux/arm64";
  engine: { executable: string; executableSha256: string; version: string; socketPath: string; configDirectory: string; daemonIdentitySha256: string; supervisorSha256: string };
  image: { reference: string; indexSha256: string; manifestSha256: string; configSha256: string };
  worker: { path: string; sha256: string; protocol: typeof SCIENTIFIC_V2_PROTOCOL };
  dependencies: { pythonVersion: string; pythonExecutable: string; pythonSha256: string; numpyVersion: string; scipyVersion: string; inventorySha256: string; blasSha256: string };
  evidence: { artifactAuthoritySha256: string; issuerPolicySha256: string; securityAssessmentSha256: string; isolationAcceptanceSha256: string; supervisorAcceptanceSha256: string };
}>;

/** Checks shape/content identity ONLY. References are not authenticated authority. */
export function validateScientificV2Profile(value: unknown, expectedSha256: string): ScientificV2Profile {
  v2Hash(expectedSha256);
  exactV2(value, ["version", "profileId", "platform", "engine", "image", "worker", "dependencies", "evidence"]);
  let encoded: string;
  try { encoded = stableScientificJson(value); } catch { return v2Fail("PROFILE_INVALID"); }
  if (Buffer.byteLength(encoded) > 65_536) v2Fail("PROFILE_INVALID");
  if (scientificSha256(encoded) !== expectedSha256) v2Fail("PROFILE_IDENTITY_MISMATCH");
  if (value.version !== "scientific-runtime-profile-v2" || !SCIENTIFIC_V2_PROFILE_IDS.includes(value.profileId as ScientificV2ProfileId) ||
    value.platform !== (value.profileId === SCIENTIFIC_V2_PROFILE_IDS[0] ? "linux/amd64" : "linux/arm64")) v2Fail("PROFILE_INVALID");
  exactV2(value.engine, ["executable", "executableSha256", "version", "socketPath", "configDirectory", "daemonIdentitySha256", "supervisorSha256"]);
  absolute(value.engine.executable); absolute(value.engine.socketPath); absolute(value.engine.configDirectory); version(value.engine.version);
  for (const key of ["executableSha256", "daemonIdentitySha256", "supervisorSha256"]) v2Hash(value.engine[key]);
  exactV2(value.image, ["reference", "indexSha256", "manifestSha256", "configSha256"]);
  for (const key of ["indexSha256", "manifestSha256", "configSha256"]) v2Hash(value.image[key]);
  if (typeof value.image.reference !== "string" || !/^[a-z0-9][a-z0-9./_-]*@sha256:[a-f0-9]{64}$/.test(value.image.reference) || (!value.image.reference.endsWith(`@sha256:${value.image.manifestSha256}`) || value.image.reference.split("/").some(part => part === "." || part === ".."))) v2Fail("IMAGE_IDENTITY_INVALID");
  exactV2(value.worker, ["path", "sha256", "protocol"]); absolute(value.worker.path); v2Hash(value.worker.sha256);
  if (!value.worker.path.startsWith("/opt/velto/") || value.worker.protocol !== SCIENTIFIC_V2_PROTOCOL) v2Fail("WORKER_INVALID");
  exactV2(value.dependencies, ["pythonVersion", "pythonExecutable", "pythonSha256", "numpyVersion", "scipyVersion", "inventorySha256", "blasSha256"]);
  absolute(value.dependencies.pythonExecutable); version(value.dependencies.pythonVersion); version(value.dependencies.numpyVersion); version(value.dependencies.scipyVersion);
  for (const key of ["pythonSha256", "inventorySha256", "blasSha256"]) v2Hash(value.dependencies[key]);
  exactV2(value.evidence, ["artifactAuthoritySha256", "issuerPolicySha256", "securityAssessmentSha256", "isolationAcceptanceSha256", "supervisorAcceptanceSha256"]);
  Object.values(value.evidence).forEach(v2Hash);
  return structuredClone(value) as ScientificV2Profile;
}

/** v2 numeric domain: finite binary64 floats, safe-range integers only.
 * Decimal tokens are bounded to 128 characters. Nonzero underflow and unsafe
 * integral values reject; lexical decimal equality is checked independently of
 * binary64 conversion. No arbitrary-precision Python integer authority is claimed.
 */
function decimalIdentity(token: string): string {
  if (token.length > 128) v2Fail("NUMERIC_DOMAIN_INVALID");
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(token);
  if (!match) return v2Fail("JSON_INVALID");
  const exponent = Number(match[4] || "0");
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000) v2Fail("NUMERIC_DOMAIN_INVALID");
  let digits = (match[2] + (match[3] || "")).replace(/^0+/, "");
  if (!digits) return "0"; // -0 and 0 represent the same scientific value.
  const trimmed = digits.replace(/0+$/, "");
  const power = exponent - (match[3]?.length || 0) + digits.length - trimmed.length;
  digits = trimmed;
  const value = Number(token);
  if (!Number.isFinite(value) || value === 0 || Math.abs(value) > Number.MAX_SAFE_INTEGER) v2Fail("NUMERIC_DOMAIN_INVALID");
  if (power >= 0) {
    const length = digits.length + power;
    if (length > 16 || (length === 16 && digits + "0".repeat(power) > "9007199254740991")) v2Fail("NUMERIC_DOMAIN_INVALID");
  }
  return `${match[1]}${digits}e${power}`;
}

/** Bounded JSON reader with separately retained numeric lexemes. */
function readScientificV2Json(bytes: Uint8Array): { value: unknown; numbers: Map<string, string> } {
  if (bytes.byteLength > SCIENTIFIC_V2_BYTE_LIMIT) v2Fail("OUTPUT_LIMIT_EXCEEDED");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return v2Fail("JSON_INVALID"); }
  const numbers = new Map<string, string>();
  let i = 0;
  const ws = () => { while (/[\t\n\r ]/.test(text[i] || "x")) i++; };
  const string = (): string => {
    const start = i++;
    while (i < text.length) {
      const c = text[i++];
      if (c === "\\") { i++; continue; }
      if (c === '"') {
        try { return JSON.parse(text.slice(start, i)) as string; } catch { return v2Fail("JSON_INVALID"); }
      }
    }
    return v2Fail("JSON_INVALID");
  };
  const read = (depth: number, location: string[]): unknown => {
    if (depth > 12) v2Fail("JSON_DEPTH_EXCEEDED");
    ws(); const c = text[i];
    if (c === '"') return string();
    if (c === "{") {
      i++; ws(); const result = Object.create(null) as Record<string, unknown>; const keys = new Set<string>();
      if (text[i] === "}") { i++; return result; }
      while (i < text.length) {
        ws(); if (text[i] !== '"') v2Fail("JSON_INVALID");
        const key = string(); if (keys.has(key)) v2Fail("JSON_DUPLICATE_KEY"); keys.add(key);
        ws(); if (text[i++] !== ":") v2Fail("JSON_INVALID"); result[key] = read(depth + 1, [...location, key]); ws();
        if (text[i] === "}") { i++; return result; }
        if (text[i++] !== ",") v2Fail("JSON_INVALID");
      }
      return v2Fail("JSON_INVALID");
    }
    if (c === "[") {
      i++; ws(); const result: unknown[] = [];
      if (text[i] === "]") { i++; return result; }
      while (i < text.length) {
        result.push(read(depth + 1, [...location, String(result.length)])); ws(); if (text[i] === "]") { i++; return result; }
        if (text[i++] !== ",") v2Fail("JSON_INVALID");
      }
      return v2Fail("JSON_INVALID");
    }
    for (const [literal, value] of [["true", true], ["false", false], ["null", null]] as const) {
      if (text.startsWith(literal, i)) { i += literal.length; return value; }
    }
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i));
    if (!match || !Number.isFinite(Number(match[0]))) v2Fail("JSON_INVALID");
    numbers.set(JSON.stringify(location), decimalIdentity(match[0]));
    i += match[0].length; return Number(match[0]);
  };
  const value = read(0, []); ws(); if (i !== text.length) v2Fail("JSON_INVALID"); return { value, numbers };
}

export function parseScientificV2Json(bytes: Uint8Array): unknown { return readScientificV2Json(bytes).value; }

const RESULT_KEYS = {
  descriptive_statistics_v1: ["n", "mean", "median", "minimum", "maximum", "variance", "standardDeviation"],
  cohens_d_independent_v1: ["nA", "nB", "cohensD", "pooledStandardDeviation"],
  normal_mean_ci_known_sigma_v1: ["n", "mean", "confidenceLevel", "lower", "upper", "marginOfError"],
  mean_t_ci_scipy_v1: ["n", "degreesOfFreedom", "mean", "confidenceLevel", "lower", "upper", "marginOfError"],
  exponential_growth_doubling_v1: ["multiplier", "logGrowthRatePerUnit", "doublingTime"],
  log_linear_model_fit_v1: ["n", "logIntercept", "logSlope", "rSquaredLogSpace", "rmseLogSpace", "doublingTime"],
} as const;
export type ScientificV2Result = { result: Record<string, number | null>; resultJson: string; resultSha256: string; stdoutSha256: string };
export function validateScientificV2Result(stdout: Uint8Array, requestValue: unknown, profile: ScientificV2Profile, profileSha256: string): ScientificV2Result {
  const request = validateScientificCalculationRequest(requestValue);
  validateScientificV2Profile(profile, profileSha256);
  const envelope = readScientificV2Json(stdout);
  const output = envelope.value;
  exactV2(output, ["protocol", "requestIdentitySha256", "profileSha256", "operation", "pythonVersion", "numpyVersion", "scipyVersion", "workerSha256", "result", "resultJson", "resultSha256"]);
  if (output.protocol !== SCIENTIFIC_V2_PROTOCOL || output.requestIdentitySha256 !== request.requestIdentitySha256 || output.profileSha256 !== profileSha256 || output.operation !== request.operation ||
    output.pythonVersion !== profile.dependencies.pythonVersion || output.numpyVersion !== profile.dependencies.numpyVersion || output.scipyVersion !== profile.dependencies.scipyVersion || output.workerSha256 !== profile.worker.sha256) v2Fail("OUTPUT_IDENTITY_MISMATCH");
  if (typeof output.resultJson !== "string") v2Fail("RESULT_INVALID");
  v2Hash(output.resultSha256);
  if (scientificSha256(output.resultJson) !== output.resultSha256) v2Fail("RESULT_DIGEST_MISMATCH");
  const producer = readScientificV2Json(Buffer.from(output.resultJson, "utf8"));
  const result = producer.value;
  exactV2(result, RESULT_KEYS[request.operation]); exactV2(output.result, RESULT_KEYS[request.operation]);
  // Flat, sorted ASCII result keys and compact separators are protocol rules.
  // Numeric lexemes remain producer bytes: do NOT reserialize floats in JS.
  const numeric = "-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?";
  const fields = [...RESULT_KEYS[request.operation]].sort().map(key => `"${key}":${key === "doublingTime" ? `(?:${numeric}|null)` : numeric}`);
  if (!new RegExp(`^\\{${fields.join(",")}\\}$`).test(output.resultJson)) v2Fail("RESULT_NOT_CANONICAL");
  // Compare normalized decimal lexemes, never rounded JS numbers. Python 2.0
  // and JS 2 agree; distinct decimals that round to one double do not.
  for (const key of RESULT_KEYS[request.operation]) {
    if (result[key] === null && output.result[key] === null) continue;
    const inner = producer.numbers.get(JSON.stringify([key]));
    const outer = envelope.numbers.get(JSON.stringify(["result", key]));
    if (!inner || inner !== outer) v2Fail("RESULT_CONSISTENCY_MISMATCH");
  }
  for (const [key, value] of Object.entries(result)) {
    if (value === null && key === "doublingTime") continue;
    if (typeof value !== "number" || !Number.isFinite(value)) v2Fail("RESULT_INVALID");
    if (["n", "nA", "nB", "degreesOfFreedom"].includes(key) && (!Number.isSafeInteger(value) || value < 1)) v2Fail("RESULT_INVALID");
  }
  const parameters = request.parameters;
  if ("n" in result && result.n !== (Array.isArray(parameters.values) ? parameters.values.length : Array.isArray(parameters.x) ? parameters.x.length : -1)) v2Fail("RESULT_COUNT_MISMATCH");
  if ("nA" in result && (result.nA !== (Array.isArray(parameters.groupA) ? parameters.groupA.length : -1) || result.nB !== (Array.isArray(parameters.groupB) ? parameters.groupB.length : -1))) v2Fail("RESULT_COUNT_MISMATCH");
  if ("degreesOfFreedom" in result && result.degreesOfFreedom !== (Array.isArray(parameters.values) ? parameters.values.length - 1 : -1)) v2Fail("RESULT_COUNT_MISMATCH");
  if ("confidenceLevel" in result && result.confidenceLevel !== parameters.confidenceLevel) v2Fail("RESULT_CONFIDENCE_MISMATCH");
  return { result: structuredClone(result) as Record<string, number | null>, resultJson: output.resultJson, resultSha256: output.resultSha256, stdoutSha256: scientificSha256(Buffer.from(stdout)) };
}

export type ScientificV2Receipt = Readonly<{
  version: "scientific-calculation-receipt-v2";
  executionMode: "OFFLINE_SYNTHETIC";
  persistence: "VOLATILE_SYNTHETIC_ONLY";
  qualification: "NOT_ESTABLISHED";
  authority: "COMPUTED_NUMERICAL_RESULT_ONLY";
  requestIdentitySha256: string; inputDataSha256: string; sourceBindingSetSha256: string;
  operation: ScientificCalculationRequest["operation"]; method: string; precision: ScientificCalculationRequest["precision"];
  runtime: ScientificV2Profile; profileSha256: string;
  result: ScientificV2Result; stdinSha256: string; stderrSha256: string;
  lifecycle: { attemptId: string; ownedName: string; containerId: string; ordinal: 1; state: "RECONCILED"; automaticRetry: false };
  sourceAuthenticityEstablished: false; scientificInterpretationEstablished: false; qualifiedHumanApproval: false; liveAuthorization: false;
  receiptSha256: string;
}>;
export function sealScientificV2Receipt(value: Omit<ScientificV2Receipt, "receiptSha256">): ScientificV2Receipt {
  return { ...structuredClone(value), receiptSha256: scientificSha256(stableScientificJson(value)) };
}
/** Expected receipt must come from retained execution evidence, not the received receipt. */
export function verifyScientificV2Receipt(value: unknown, expected: ScientificV2Receipt): ScientificV2Receipt {
  if (stableScientificJson(value) !== stableScientificJson(expected)) v2Fail("RECEIPT_TAMPERED");
  const { receiptSha256, ...body } = expected;
  if (scientificSha256(stableScientificJson(body)) !== receiptSha256 || expected.executionMode !== "OFFLINE_SYNTHETIC" || expected.persistence !== "VOLATILE_SYNTHETIC_ONLY" || expected.qualification !== "NOT_ESTABLISHED" || expected.liveAuthorization !== false || expected.sourceAuthenticityEstablished !== false || expected.scientificInterpretationEstablished !== false || expected.qualifiedHumanApproval !== false || expected.authority !== "COMPUTED_NUMERICAL_RESULT_ONLY" || expected.lifecycle.automaticRetry !== false || expected.lifecycle.ordinal !== 1 || expected.lifecycle.state !== "RECONCILED") v2Fail("RECEIPT_INVALID");
  return structuredClone(expected);
}
