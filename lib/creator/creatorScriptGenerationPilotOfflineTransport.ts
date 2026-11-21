import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  realpath,
  readdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";

import type {
  CreatorScriptGenerationPilotMockReceipt,
  CreatorScriptGenerationPilotMockTransport,
  CreatorScriptGenerationPilotPublicEvidenceFixture,
} from "./creatorScriptGenerationPilotHarness.ts";

export const STAGE_5E1A_PINNED_MODEL = "gpt-6.1-sol" as const;
export const STAGE_5E1A_RESPONSES_ENDPOINT =
  "https://api.openai.com/v1/responses" as const;
export const STAGE_5E1A_MAXIMUM_ATTEMPTS = 5;
export const STAGE_5E1A_MAXIMUM_INPUT_TOKENS_PER_REQUEST = 20_000;
export const STAGE_5E1A_MAXIMUM_OUTPUT_TOKENS_PER_REQUEST = 25_000;
export const STAGE_5E1A_MAXIMUM_COST_USD = 1.65;

const CONSERVATIVE_INPUT_USD_PER_MILLION = 2.5;
const STANDARD_OUTPUT_USD_PER_MILLION = 10;
const REGIONAL_UPLIFT_MULTIPLIER = 1.1;
const LEDGER_VERSION = "stage-5e1a-attempt-ledger-v1" as const;
const MAXIMUM_LEDGER_RECORD_BYTES = 64 * 1024;

type GenerationProviderRequest = Parameters<CreatorScriptGenerationPilotMockTransport>[0]["request"];

export type Stage5e1aResponsesRequest = Readonly<{
  endpoint: typeof STAGE_5E1A_RESPONSES_ENDPOINT;
  body: Readonly<{
    model: typeof STAGE_5E1A_PINNED_MODEL;
    service_tier: "default";
    input: readonly Readonly<{
      role: "system" | "user";
      content: string;
    }>[];
    text: Readonly<{
      format: Readonly<{
        type: "json_schema";
        name: string;
        strict: true;
        schema: Record<string, unknown>;
      }>;
    }>;
    max_output_tokens: number;
    reasoning: Readonly<{ effort: "medium" }>;
    tools: readonly [];
    store: false;
    background: false;
  }>;
  requestOptions: Readonly<{ maxRetries: 0 }>;
}>;

export type Stage5e1aTokenAdmission = Readonly<{
  model: typeof STAGE_5E1A_PINNED_MODEL;
  requestInputFingerprintSha256: string;
  inputTokensUpperBound: number;
  assurance: "model_compatible_verified_upper_bound";
  method: string;
}>;

export type Stage5e1aTokenCounter = (
  request: Stage5e1aResponsesRequest,
) => Stage5e1aTokenAdmission;

export type Stage5e1aMockDispatcherReceipt = Readonly<{
  status: "completed" | "timeout" | "ambiguous";
  endpoint: string;
  model: string;
  serviceTier: string;
  requestFingerprintSha256: string;
  responseId: string | null;
  attemptCount: number;
  completionStatus: "completed" | "incomplete" | null;
  usage: Readonly<{
    inputTokens: number;
    outputTokens: number;
  }> | null;
  output: Record<string, unknown> | null;
  observedNetworkDestinations: readonly string[];
}>;

export type Stage5e1aMockDispatcher = (
  request: Stage5e1aResponsesRequest,
) => Promise<Stage5e1aMockDispatcherReceipt>;

export type Stage5e1aOfflineEnvelope = Readonly<{
  version: "stage-5e1a-offline-envelope-v1";
  model: typeof STAGE_5E1A_PINNED_MODEL;
  serviceTier: "default";
  endpoint: typeof STAGE_5E1A_RESPONSES_ENDPOINT;
  maximumAttempts: 5;
  maximumInputTokensPerRequest: number;
  maximumOutputTokensPerRequest: number;
  maximumCostUsd: number;
  pricing: Readonly<{
    currency: "USD";
    conservativeInputUsdPerMillionTokens: 2.5;
    outputUsdPerMillionTokens: 10;
    regionalUpliftMultiplier: 1.1;
    source: "openai-official-pricing-2026-10-25";
  }>;
}>;

type AttemptMarker = Readonly<{
  version: typeof LEDGER_VERSION;
  runId: string;
  ordinal: number;
  logicalOperationId: string;
  sectionId: string;
  requestFingerprintSha256: string;
  state: "authorization_consumed_before_dispatch";
}>;

type AttemptOutcome = Readonly<{
  version: typeof LEDGER_VERSION;
  runId: string;
  ordinal: number;
  state: "completed" | "ambiguous" | "rejected_receipt";
  responseId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
}>;

function fail(code: string): never {
  throw new Error(code);
}

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function createStage5e1aOfflineEnvelope(): Stage5e1aOfflineEnvelope {
  return Object.freeze({
    version: "stage-5e1a-offline-envelope-v1",
    model: STAGE_5E1A_PINNED_MODEL,
    serviceTier: "default",
    endpoint: STAGE_5E1A_RESPONSES_ENDPOINT,
    maximumAttempts: STAGE_5E1A_MAXIMUM_ATTEMPTS,
    maximumInputTokensPerRequest: STAGE_5E1A_MAXIMUM_INPUT_TOKENS_PER_REQUEST,
    maximumOutputTokensPerRequest: STAGE_5E1A_MAXIMUM_OUTPUT_TOKENS_PER_REQUEST,
    maximumCostUsd: STAGE_5E1A_MAXIMUM_COST_USD,
    pricing: Object.freeze({
      currency: "USD",
      conservativeInputUsdPerMillionTokens: CONSERVATIVE_INPUT_USD_PER_MILLION,
      outputUsdPerMillionTokens: STANDARD_OUTPUT_USD_PER_MILLION,
      regionalUpliftMultiplier: REGIONAL_UPLIFT_MULTIPLIER,
      source: "openai-official-pricing-2026-10-25",
    }),
  });
}

export function calculateStage5e1aWorstCaseCostUsd(envelope: Stage5e1aOfflineEnvelope) {
  const base = (
    envelope.maximumAttempts * envelope.maximumInputTokensPerRequest *
      envelope.pricing.conservativeInputUsdPerMillionTokens +
    envelope.maximumAttempts * envelope.maximumOutputTokensPerRequest *
      envelope.pricing.outputUsdPerMillionTokens
  ) / 1_000_000;
  return Number((base * envelope.pricing.regionalUpliftMultiplier).toFixed(6));
}

function validateEnvelope(envelope: Stage5e1aOfflineEnvelope) {
  if (
    envelope.version !== "stage-5e1a-offline-envelope-v1" ||
    envelope.model !== STAGE_5E1A_PINNED_MODEL ||
    envelope.serviceTier !== "default" ||
    envelope.endpoint !== STAGE_5E1A_RESPONSES_ENDPOINT ||
    envelope.maximumAttempts !== STAGE_5E1A_MAXIMUM_ATTEMPTS ||
    envelope.maximumInputTokensPerRequest !== STAGE_5E1A_MAXIMUM_INPUT_TOKENS_PER_REQUEST ||
    envelope.maximumOutputTokensPerRequest !== STAGE_5E1A_MAXIMUM_OUTPUT_TOKENS_PER_REQUEST ||
    envelope.pricing.currency !== "USD" ||
    envelope.pricing.conservativeInputUsdPerMillionTokens !== CONSERVATIVE_INPUT_USD_PER_MILLION ||
    envelope.pricing.outputUsdPerMillionTokens !== STANDARD_OUTPUT_USD_PER_MILLION ||
    envelope.pricing.regionalUpliftMultiplier !== REGIONAL_UPLIFT_MULTIPLIER ||
    envelope.pricing.source !== "openai-official-pricing-2026-10-25"
  ) fail("STAGE_5E1A_ENVELOPE_INVALID");
  const reservedCostUsd = calculateStage5e1aWorstCaseCostUsd(envelope);
  if (reservedCostUsd !== envelope.maximumCostUsd) {
    fail("STAGE_5E1A_COST_RESERVATION_INVALID");
  }
  return reservedCostUsd;
}

export function requestInputFingerprintSha256(request: Stage5e1aResponsesRequest) {
  return sha256(stableJson({
    input: request.body.input,
    text: request.body.text,
  }));
}

export function stage5e1aRequestFingerprintSha256(request: Stage5e1aResponsesRequest) {
  return sha256(stableJson(request));
}

function createResponsesRequest(
  request: GenerationProviderRequest,
  envelope: Stage5e1aOfflineEnvelope,
): Stage5e1aResponsesRequest {
  if (
    request.operationType !== "creator_script_build_script_generation" ||
    request.model !== envelope.model ||
    request.reasoningEffort !== "medium"
  ) fail("STAGE_5E1A_PROVIDER_REQUEST_INVALID");
  return Object.freeze({
    endpoint: STAGE_5E1A_RESPONSES_ENDPOINT,
    body: Object.freeze({
      model: STAGE_5E1A_PINNED_MODEL,
      service_tier: "default",
      input: Object.freeze([
        Object.freeze({ role: "system", content: request.system }),
        Object.freeze({ role: "user", content: JSON.stringify(request.user) }),
      ]),
      text: Object.freeze({
        format: Object.freeze({
          type: "json_schema",
          name: request.schemaName,
          strict: true,
          schema: request.schema,
        }),
      }),
      max_output_tokens: envelope.maximumOutputTokensPerRequest,
      reasoning: Object.freeze({ effort: "medium" }),
      tools: Object.freeze([]) as readonly [],
      store: false,
      background: false,
    }),
    requestOptions: Object.freeze({ maxRetries: 0 }),
  });
}

async function writeExclusiveJson(filePath: string, value: unknown) {
  const handle = await open(filePath, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncDirectory(directory: string) {
  const handle = await open(directory, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function verifyPrivateDirectory(directory: string, errorCode: string) {
  const current = await lstat(directory).catch(() => fail(errorCode));
  if (
    current.isSymbolicLink() ||
    !current.isDirectory() ||
    (current.mode & 0o077) !== 0
  ) fail(errorCode);
  const canonical = await realpath(directory).catch(() => fail(errorCode));
  return canonical;
}

async function resolvePrivateLedgerDirectory(privateRootDirectory: string, runId: string) {
  if (!path.isAbsolute(privateRootDirectory)) {
    fail("STAGE_5E1A_LEDGER_ROOT_INVALID");
  }
  const canonicalRoot = await verifyPrivateDirectory(
    privateRootDirectory,
    "STAGE_5E1A_LEDGER_ROOT_NOT_PRIVATE",
  );
  const directory = path.join(canonicalRoot, `run-${sha256(runId)}`);
  await mkdir(directory, { mode: 0o700, recursive: false }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") throw error;
  });
  await verifyPrivateDirectory(directory, "STAGE_5E1A_LEDGER_DIRECTORY_NOT_PRIVATE");
  return directory;
}

async function readSecureJson(filePath: string): Promise<unknown> {
  let handle;
  try {
    handle = await open(
      filePath,
      fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW,
    );
    const current = await handle.stat();
    if (
      !current.isFile() ||
      current.nlink !== 1 ||
      (current.mode & 0o077) !== 0 ||
      current.size <= 0 ||
      current.size > MAXIMUM_LEDGER_RECORD_BYTES
    ) fail("STAGE_5E1A_LEDGER_CORRUPT");
    return JSON.parse(await handle.readFile("utf8"));
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "STAGE_5E1A_LEDGER_CORRUPT") {
      throw error;
    }
    fail("STAGE_5E1A_LEDGER_CORRUPT");
  } finally {
    await handle?.close();
  }
}

async function withLedgerLock<T>(directory: string, action: () => Promise<T>) {
  const lockPath = path.join(directory, ".attempt-ledger.lock");
  let lock;
  try {
    lock = await open(lockPath, "wx", 0o600);
    await lock.writeFile(`${process.pid}\n`, "utf8");
    await lock.sync();
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      fail("STAGE_5E1A_LEDGER_BUSY");
    }
    throw error;
  }
  try {
    return await action();
  } finally {
    await lock?.close();
    await unlink(lockPath);
    await syncDirectory(directory);
  }
}

class Stage5e1aAttemptLedger {
  private readonly directory: string;
  private readonly runId: string;

  constructor(
    directory: string,
    runId: string,
  ) {
    this.directory = directory;
    this.runId = runId;
  }

  async initialize(manifest: Record<string, unknown>) {
    const manifestPath = path.join(this.directory, "manifest.json");
    try {
      await writeExclusiveJson(manifestPath, manifest);
      await syncDirectory(this.directory);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existing = await readSecureJson(manifestPath);
      if (stableJson(existing) !== stableJson(manifest)) {
        fail("STAGE_5E1A_LEDGER_MANIFEST_CONFLICT");
      }
    }
  }

  async consume(input: Omit<AttemptMarker, "version" | "runId" | "ordinal" | "state">) {
    return await withLedgerLock(this.directory, async () => {
      const files = await readdir(this.directory);
      const markerFiles = files.filter((file) => /^attempt-\d{2}\.json$/.test(file)).toSorted();
      const outcomeFiles = files.filter((file) => /^outcome-\d{2}\.json$/.test(file)).toSorted();
      const outcomes = await Promise.all(outcomeFiles.map(async (file) =>
        await readSecureJson(path.join(this.directory, file)) as AttemptOutcome
      ));
      const markers = await Promise.all(markerFiles.map(async (file) =>
        await readSecureJson(path.join(this.directory, file)) as AttemptMarker
      ));
      const markerOrdinals = new Set(markers.map((marker) => marker.ordinal));
      const outcomeOrdinals = new Set(outcomes.map((outcome) => outcome.ordinal));
      const recordsValid = markers.every((marker, index) =>
        marker.version === LEDGER_VERSION &&
        marker.runId === this.runId &&
        marker.ordinal === index + 1 &&
        marker.state === "authorization_consumed_before_dispatch" &&
        Boolean(marker.logicalOperationId) &&
        Boolean(marker.sectionId) &&
        /^[a-f0-9]{64}$/.test(marker.requestFingerprintSha256)
      ) && outcomes.every((outcome) =>
        outcome.version === LEDGER_VERSION &&
        outcome.runId === this.runId &&
        markerOrdinals.has(outcome.ordinal) &&
        (outcome.state === "completed" ||
          outcome.state === "ambiguous" ||
          outcome.state === "rejected_receipt")
      ) && markerOrdinals.size === markers.length &&
        outcomeOrdinals.size === outcomes.length;
      if (!recordsValid) fail("STAGE_5E1A_LEDGER_CORRUPT");
      if (
        outcomes.some((outcome) => outcome.state !== "completed") ||
        markers.some((marker) => !outcomeOrdinals.has(marker.ordinal))
      ) fail("STAGE_5E1A_RUN_BLOCKED_AMBIGUOUS");
      if (markers.some((marker) => marker.logicalOperationId === input.logicalOperationId)) {
        fail("STAGE_5E1A_DUPLICATE_DISPATCH");
      }
      if (markers.length >= STAGE_5E1A_MAXIMUM_ATTEMPTS) {
        fail("STAGE_5E1A_ATTEMPT_LIMIT_EXHAUSTED");
      }
      const ordinal = markers.length + 1;
      const marker: AttemptMarker = Object.freeze({
        version: LEDGER_VERSION,
        runId: this.runId,
        ordinal,
        logicalOperationId: input.logicalOperationId,
        sectionId: input.sectionId,
        requestFingerprintSha256: input.requestFingerprintSha256,
        state: "authorization_consumed_before_dispatch",
      });
      await writeExclusiveJson(
        path.join(this.directory, `attempt-${String(ordinal).padStart(2, "0")}.json`),
        marker,
      );
      await syncDirectory(this.directory);
      return marker;
    });
  }

  async recordOutcome(outcome: AttemptOutcome) {
    await writeExclusiveJson(
      path.join(this.directory, `outcome-${String(outcome.ordinal).padStart(2, "0")}.json`),
      outcome,
    );
    await syncDirectory(this.directory);
  }
}

function verifyPublicDocuments(input: {
  fixture: CreatorScriptGenerationPilotPublicEvidenceFixture;
  publicDocumentBytes: ReadonlyMap<string, Uint8Array>;
}) {
  for (const verification of input.fixture.sourceVerifications) {
    const bytes = input.publicDocumentBytes.get(verification.sourceId);
    if (!bytes || sha256(bytes) !== verification.documentSha256) {
      fail("STAGE_5E1A_SOURCE_DOCUMENT_HASH_INVALID");
    }
  }
  if (input.publicDocumentBytes.size !== input.fixture.sourceVerifications.length) {
    fail("STAGE_5E1A_SOURCE_DOCUMENT_SET_INVALID");
  }
}

function validateTokenAdmission(input: {
  admission: Stage5e1aTokenAdmission;
  request: Stage5e1aResponsesRequest;
  envelope: Stage5e1aOfflineEnvelope;
}) {
  if (
    input.admission.model !== input.envelope.model ||
    input.admission.assurance !== "model_compatible_verified_upper_bound" ||
    !input.admission.method.trim() ||
    input.admission.requestInputFingerprintSha256 !==
      requestInputFingerprintSha256(input.request) ||
    !Number.isInteger(input.admission.inputTokensUpperBound) ||
    input.admission.inputTokensUpperBound <= 0
  ) fail("STAGE_5E1A_TOKEN_ADMISSION_UNCERTAIN");
  if (input.admission.inputTokensUpperBound > input.envelope.maximumInputTokensPerRequest) {
    fail("STAGE_5E1A_INPUT_TOKEN_LIMIT_EXCEEDED");
  }
}

export async function createStage5e1aOfflineTransport(input: {
  runId: string;
  privateRootDirectory: string;
  fixture: CreatorScriptGenerationPilotPublicEvidenceFixture;
  publicDocumentBytes: ReadonlyMap<string, Uint8Array>;
  envelope: Stage5e1aOfflineEnvelope;
  tokenCounter: Stage5e1aTokenCounter;
  mockDispatcher: Stage5e1aMockDispatcher;
  liveProviderAccess: false;
}): Promise<Readonly<{
  transport: CreatorScriptGenerationPilotMockTransport;
  reservedCostUsd: number;
  ledgerDirectory: string;
}>> {
  if (input.liveProviderAccess !== false) fail("STAGE_5E1A_LIVE_PROVIDER_DISABLED");
  if (!input.runId.trim()) fail("STAGE_5E1A_RUN_ID_INVALID");
  const reservedCostUsd = validateEnvelope(input.envelope);
  const envelope = createStage5e1aOfflineEnvelope();
  const tokenCounter = input.tokenCounter;
  const mockDispatcher = input.mockDispatcher;
  verifyPublicDocuments(input);
  const ledgerDirectory = await resolvePrivateLedgerDirectory(
    input.privateRootDirectory,
    input.runId,
  );
  const ledger = new Stage5e1aAttemptLedger(ledgerDirectory, input.runId);
  await ledger.initialize({
    version: LEDGER_VERSION,
    runId: input.runId,
    fixtureFingerprintSha256: sha256(stableJson(input.fixture)),
    envelopeFingerprintSha256: sha256(stableJson(envelope)),
    maximumAttempts: STAGE_5E1A_MAXIMUM_ATTEMPTS,
    reservedCostUsd,
  });

  const transport: CreatorScriptGenerationPilotMockTransport = async ({ request, controls }) => {
    if (
      controls.model !== envelope.model ||
      controls.maxOutputTokens !== envelope.maximumOutputTokensPerRequest ||
      controls.maxRetries !== 0
    ) fail("STAGE_5E1A_TRANSPORT_CONTROLS_INVALID");
    const responsesRequest = createResponsesRequest(request, envelope);
    const admission = tokenCounter(responsesRequest);
    validateTokenAdmission({ admission, request: responsesRequest, envelope });
    const sectionId = (request.user as { activeSection?: { id?: unknown } }).activeSection?.id;
    if (typeof sectionId !== "string") fail("STAGE_5E1A_SECTION_ID_MISSING");
    const fingerprint = stage5e1aRequestFingerprintSha256(responsesRequest);
    const marker = await ledger.consume({
      logicalOperationId: request.logicalOperationId,
      sectionId,
      requestFingerprintSha256: fingerprint,
    });

    let receipt: Stage5e1aMockDispatcherReceipt;
    try {
      receipt = await mockDispatcher(responsesRequest);
    } catch {
      await ledger.recordOutcome({
        version: LEDGER_VERSION,
        runId: input.runId,
        ordinal: marker.ordinal,
        state: "ambiguous",
        responseId: null,
        inputTokens: null,
        outputTokens: null,
      });
      fail("STAGE_5E1A_PROVIDER_COMPLETION_AMBIGUOUS");
    }
    if (!receipt || typeof receipt !== "object") {
      await ledger.recordOutcome({
        version: LEDGER_VERSION,
        runId: input.runId,
        ordinal: marker.ordinal,
        state: "rejected_receipt",
        responseId: null,
        inputTokens: null,
        outputTokens: null,
      });
      fail("STAGE_5E1A_PROVIDER_RECEIPT_INVALID");
    }
    if (
      receipt.status !== "completed" ||
      receipt.endpoint !== STAGE_5E1A_RESPONSES_ENDPOINT ||
      receipt.model !== STAGE_5E1A_PINNED_MODEL ||
      receipt.serviceTier !== "default" ||
      receipt.requestFingerprintSha256 !== fingerprint ||
      receipt.attemptCount !== 1 ||
      receipt.completionStatus !== "completed" ||
      !receipt.responseId ||
      !receipt.usage ||
      !receipt.output ||
      receipt.observedNetworkDestinations.length !== 0 ||
      !Number.isInteger(receipt.usage.inputTokens) ||
      receipt.usage.inputTokens < 0 ||
      receipt.usage.inputTokens > admission.inputTokensUpperBound ||
      !Number.isInteger(receipt.usage.outputTokens) ||
      receipt.usage.outputTokens < 0 ||
      receipt.usage.outputTokens > envelope.maximumOutputTokensPerRequest
    ) {
      await ledger.recordOutcome({
        version: LEDGER_VERSION,
        runId: input.runId,
        ordinal: marker.ordinal,
        state: "ambiguous",
        responseId: receipt.responseId,
        inputTokens: receipt.usage?.inputTokens ?? null,
        outputTokens: receipt.usage?.outputTokens ?? null,
      });
      fail(receipt.status === "timeout" || receipt.status === "ambiguous"
        ? "STAGE_5E1A_PROVIDER_COMPLETION_AMBIGUOUS"
        : "STAGE_5E1A_PROVIDER_RECEIPT_INVALID");
    }
    await ledger.recordOutcome({
      version: LEDGER_VERSION,
      runId: input.runId,
      ordinal: marker.ordinal,
      state: "completed",
      responseId: receipt.responseId,
      inputTokens: receipt.usage.inputTokens,
      outputTokens: receipt.usage.outputTokens,
    });
    return {
      status: "completed",
      requestId: receipt.responseId,
      attemptCount: 1,
      inputTokens: receipt.usage.inputTokens,
      outputTokens: receipt.usage.outputTokens,
      output: receipt.output,
    } satisfies CreatorScriptGenerationPilotMockReceipt;
  };

  return Object.freeze({ transport, reservedCostUsd, ledgerDirectory });
}
