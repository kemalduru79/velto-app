import { scientificSha256, stableScientificJson } from "./authorityContracts.ts";

export function scientificCalculationFail(reason: string): never {
  throw new Error(`STAGE_5E1G_B_${reason}`);
}

export const SCIENTIFIC_CALCULATION_REQUEST_VERSION = "stage-5e1g-b-calculation-request-v1" as const;
export const SCIENTIFIC_CALCULATION_RECEIPT_VERSION = "stage-5e1g-b-calculation-receipt-v1" as const;
export const SCIENTIFIC_CALCULATION_OPERATIONS = [
  "descriptive_statistics_v1",
  "cohens_d_independent_v1",
  "normal_mean_ci_known_sigma_v1",
  "mean_t_ci_scipy_v1",
  "exponential_growth_doubling_v1",
  "log_linear_model_fit_v1",
] as const;
export type ScientificCalculationOperation = (typeof SCIENTIFIC_CALCULATION_OPERATIONS)[number];

export const SCIENTIFIC_CALCULATION_METHODS: Readonly<Record<ScientificCalculationOperation, string>> = {
  descriptive_statistics_v1: "arithmetic_descriptive_statistics_v1",
  cohens_d_independent_v1: "pooled_standardized_mean_difference_v1",
  normal_mean_ci_known_sigma_v1: "normal_z_interval_known_population_sigma_v1",
  mean_t_ci_scipy_v1: "scipy_student_t_interval_v1",
  exponential_growth_doubling_v1: "two_point_log_growth_rate_v1",
  log_linear_model_fit_v1: "ordinary_least_squares_log_response_v1",
};

export type ScientificCalculationSourceBinding = Readonly<{
  sourceId: string;
  sourceVersion: string;
  documentSha256: string;
  evidenceIds: readonly string[];
  dataKeys: readonly string[];
  dataFingerprintSha256: string;
}>;
export type ScientificCalculationPrecision = Readonly<{
  decimalPlaces: number;
  absoluteTolerance: number;
  relativeTolerance: number;
}>;
export type ScientificCalculationRequest = Readonly<{
  version: typeof SCIENTIFIC_CALCULATION_REQUEST_VERSION;
  operationId: string;
  operation: ScientificCalculationOperation;
  method: string;
  sourceBindings: readonly ScientificCalculationSourceBinding[];
  parameters: Readonly<Record<string, unknown>>;
  inputDataSha256: string;
  precision: ScientificCalculationPrecision;
  limitations: readonly string[];
  requestIdentitySha256: string;
}>;
export type ScientificCalculationReceipt = Readonly<{
  version: typeof SCIENTIFIC_CALCULATION_RECEIPT_VERSION;
  operationId: string;
  operation: ScientificCalculationOperation;
  method: string;
  authority: "COMPUTED_NUMERICAL_RESULT_ONLY";
  requestIdentitySha256: string;
  inputDataSha256: string;
  sourceBindingSetSha256: string;
  runtime: Readonly<{
    profileId: string;
    pythonVersion: string;
    scipyVersion: string;
    pythonExecutableSha256: string;
    workerSha256: string;
    networkIsolation: "NOT_OS_ENFORCED";
  }>;
  precision: ScientificCalculationPrecision;
  numericalResult: Readonly<Record<string, unknown>>;
  numericalResultSha256: string;
  limitations: readonly string[];
  reproducibility: "TOLERANCE_BOUNDED_DETERMINISTIC_ALGORITHM";
  attemptOrdinal: 1;
  sourceAuthenticityEstablished: false;
  scientificInterpretationEstablished: false;
  qualifiedHumanApproval: false;
  liveAuthorization: false;
}>;

export function computeScientificCalculationInputDataSha256(parameters: Readonly<Record<string, unknown>>): string {
  return scientificSha256(stableScientificJson(parameters));
}
export function computeScientificCalculationRequestIdentity(
  request: Omit<ScientificCalculationRequest, "requestIdentitySha256">,
): string {
  return scientificSha256(stableScientificJson(request));
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function exactKeys(value: unknown, keys: readonly string[], label: string) {
  if (!record(value) || Object.keys(value).some((key) => !keys.includes(key)) || keys.some((key) => !(key in value))) {
    scientificCalculationFail(`CALCULATION_${label}_SCHEMA_INVALID`);
  }
}
function id(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(value)) {
    scientificCalculationFail(`CALCULATION_${label}_INVALID`);
  }
  return value;
}
function sha(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) scientificCalculationFail(`CALCULATION_${label}_INVALID`);
  return value;
}
function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 1e100) {
    scientificCalculationFail(`CALCULATION_${label}_INVALID`);
  }
  return value;
}
function finiteTree(value: unknown, depth = 0): void {
  if (depth > 8) scientificCalculationFail("CALCULATION_PARAMETERS_TOO_DEEP");
  if (typeof value === "number") { finite(value, "PARAMETER_NUMBER"); return; }
  if (typeof value === "string") {
    if (value.length > 500) scientificCalculationFail("CALCULATION_PARAMETER_STRING_INVALID");
    return;
  }
  if (typeof value === "boolean" || value === null) return;
  if (Array.isArray(value)) {
    if (value.length > 10_000) scientificCalculationFail("CALCULATION_PARAMETER_ARRAY_INVALID");
    value.forEach((entry) => finiteTree(entry, depth + 1));
    return;
  }
  if (record(value)) {
    if (Object.keys(value).length > 20) scientificCalculationFail("CALCULATION_PARAMETER_OBJECT_INVALID");
    Object.entries(value).forEach(([key, entry]) => { id(key, "PARAMETER_KEY"); finiteTree(entry, depth + 1); });
    return;
  }
  scientificCalculationFail("CALCULATION_PARAMETER_TYPE_INVALID");
}

export function validateScientificCalculationRequest(value: unknown): ScientificCalculationRequest {
  exactKeys(value, ["version", "operationId", "operation", "method", "sourceBindings", "parameters", "inputDataSha256", "precision", "limitations", "requestIdentitySha256"], "REQUEST");
  if (!record(value) || value.version !== SCIENTIFIC_CALCULATION_REQUEST_VERSION ||
    !SCIENTIFIC_CALCULATION_OPERATIONS.includes(value.operation as ScientificCalculationOperation)) {
    scientificCalculationFail("CALCULATION_REQUEST_VERSION_OR_OPERATION_INVALID");
  }
  const operation = value.operation as ScientificCalculationOperation;
  if (value.method !== SCIENTIFIC_CALCULATION_METHODS[operation]) scientificCalculationFail("CALCULATION_METHOD_MISMATCH");
  if (!Array.isArray(value.sourceBindings) || value.sourceBindings.length === 0 || value.sourceBindings.length > 100) {
    scientificCalculationFail("CALCULATION_SOURCE_BINDINGS_INVALID");
  }
  const sourceBindings = value.sourceBindings.map((binding) => {
    exactKeys(binding, ["sourceId", "sourceVersion", "documentSha256", "evidenceIds", "dataKeys", "dataFingerprintSha256"], "SOURCE_BINDING");
    if (!record(binding) || typeof binding.sourceVersion !== "string" || binding.sourceVersion.length === 0 || binding.sourceVersion.length > 200 ||
      !Array.isArray(binding.evidenceIds) || binding.evidenceIds.length === 0 || binding.evidenceIds.length > 100 ||
      !Array.isArray(binding.dataKeys) || binding.dataKeys.length === 0 || binding.dataKeys.length > 20) {
      scientificCalculationFail("CALCULATION_SOURCE_BINDING_INVALID");
    }
    const evidenceIds = binding.evidenceIds.map((entry) => id(entry, "EVIDENCE_ID"));
    const dataKeys = binding.dataKeys.map((entry) => id(entry, "DATA_KEY"));
    if (new Set(evidenceIds).size !== evidenceIds.length) scientificCalculationFail("CALCULATION_DUPLICATE_EVIDENCE_ID");
    if (new Set(dataKeys).size !== dataKeys.length) scientificCalculationFail("CALCULATION_DUPLICATE_DATA_KEY");
    return { sourceId: id(binding.sourceId, "SOURCE_ID"), sourceVersion: binding.sourceVersion,
      documentSha256: sha(binding.documentSha256, "DOCUMENT_SHA256"), evidenceIds, dataKeys,
      dataFingerprintSha256: sha(binding.dataFingerprintSha256, "DATA_FINGERPRINT_SHA256") };
  });
  if (new Set(sourceBindings.map((binding) => binding.sourceId)).size !== sourceBindings.length) {
    scientificCalculationFail("CALCULATION_DUPLICATE_SOURCE_ID");
  }
  if (!record(value.parameters)) scientificCalculationFail("CALCULATION_PARAMETERS_INVALID");
  const parameters = value.parameters as Record<string, unknown>;
  finiteTree(parameters);
  const assignedDataKeys = sourceBindings.flatMap((binding) => binding.dataKeys);
  if (new Set(assignedDataKeys).size !== assignedDataKeys.length ||
    stableScientificJson([...new Set(assignedDataKeys)].sort()) !== stableScientificJson(Object.keys(parameters).sort())) {
    scientificCalculationFail("CALCULATION_SOURCE_DATA_COVERAGE_INVALID");
  }
  for (const binding of sourceBindings) {
    const projection = Object.fromEntries([...binding.dataKeys].sort().map((key) => [key, parameters[key]]));
    if (scientificSha256(stableScientificJson(projection)) !== binding.dataFingerprintSha256) {
      scientificCalculationFail("CALCULATION_SOURCE_DATA_FINGERPRINT_MISMATCH");
    }
  }
  exactKeys(value.precision, ["decimalPlaces", "absoluteTolerance", "relativeTolerance"], "PRECISION");
  if (!record(value.precision) || !Number.isSafeInteger(value.precision.decimalPlaces) ||
    (value.precision.decimalPlaces as number) < 4 || (value.precision.decimalPlaces as number) > 15) {
    scientificCalculationFail("CALCULATION_PRECISION_INVALID");
  }
  const precision = { decimalPlaces: value.precision.decimalPlaces as number,
    absoluteTolerance: finite(value.precision.absoluteTolerance, "ABSOLUTE_TOLERANCE"),
    relativeTolerance: finite(value.precision.relativeTolerance, "RELATIVE_TOLERANCE") };
  if (precision.absoluteTolerance <= 0 || precision.relativeTolerance <= 0) scientificCalculationFail("CALCULATION_TOLERANCE_INVALID");
  if (!Array.isArray(value.limitations) || value.limitations.length === 0 || value.limitations.length > 100 ||
    !value.limitations.every((item) => typeof item === "string" && item.length > 0 && item.length <= 500)) {
    scientificCalculationFail("CALCULATION_LIMITATIONS_INVALID");
  }
  const parsed = {
    version: SCIENTIFIC_CALCULATION_REQUEST_VERSION,
    operationId: id(value.operationId, "OPERATION_ID"), operation, method: value.method,
    sourceBindings, parameters: structuredClone(parameters),
    inputDataSha256: sha(value.inputDataSha256, "INPUT_DATA_SHA256"), precision,
    limitations: structuredClone(value.limitations),
    requestIdentitySha256: sha(value.requestIdentitySha256, "REQUEST_IDENTITY_SHA256"),
  } as ScientificCalculationRequest;
  if (computeScientificCalculationInputDataSha256(parsed.parameters) !== parsed.inputDataSha256) {
    scientificCalculationFail("CALCULATION_INPUT_DATA_HASH_MISMATCH");
  }
  const { requestIdentitySha256: _ignored, ...identityInput } = parsed;
  if (computeScientificCalculationRequestIdentity(identityInput) !== parsed.requestIdentitySha256) {
    scientificCalculationFail("CALCULATION_REQUEST_IDENTITY_MISMATCH");
  }
  return parsed;
}
