import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { STAGE4B2_APPROVED_ABSTRACT_URL, STAGE4B2_SOURCE_IDENTITY, verifyStage4b2PdfPassage, type Stage4b2PdfArtifact } from "./stage4b2PdfEvidence.server.ts";
import { normalizeStage4b2VerbatimPassage } from "./stage4b2Verbatim.ts";

export const STAGE4B2_APPROVED_SOURCE_URL = STAGE4B2_APPROVED_ABSTRACT_URL;
export const STAGE4B2_CONTENTS_ENDPOINT = "https://api.exa.ai/contents";
export const STAGE4B2_CONSUMED_EXECUTION_IDS = new Set(["stage4b2-20261019-search-1", "stage4b2-20261019-contents-2"]);

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord => value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const compact = (value: string) => value.replace(/\s+/gu, " ").trim();
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const isUrlIdentity = (value: unknown) => {
  if (typeof value !== "string") return false;
  try { new URL(value); return true; }
  catch { return false; }
};

export type Stage4b2SourceDiagnostic = "PROVIDER_RESPONSE_MALFORMED" | "SOURCE_NOT_DISCOVERED" | "SOURCE_IDENTITY_MISMATCH" | "SOURCE_CONTENT_UNAVAILABLE" | "SOURCE_PASSAGE_NOT_VERIFIED" | "DOCUMENT_SCOPE_MISMATCH";

export function createStage4b2ContentsRequest() {
  return {
    urls: [STAGE4B2_APPROVED_SOURCE_URL],
    highlights: { query: "agent behavior simulation evidence limitations", maxCharacters: 4000 },
  };
}

export function normalizeStage4b2SourceIdentity(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    url.hash = "";
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.hostname = url.hostname.toLowerCase().replace(/\.$/u, "");
    url.pathname = url.pathname.replace(/\/+$/u, "") || "/";
    return url.toString();
  } catch { return null; }
}

export function classifyStage4b2ContentsResponse(input: { response: unknown; independentlyRetrievedText: string; approvedPdfArtifact?: Stage4b2PdfArtifact; diagnosticOfficialRepresentations?: string[] }) {
  if (input.response === null || typeof input.response !== "object" || Array.isArray(input.response) || !Array.isArray((input.response as JsonRecord).results)) {
    return { ok: false as const, reason: "PROVIDER_RESPONSE_MALFORMED" as Stage4b2SourceDiagnostic, safeCandidateUrls: [] };
  }
  const payload = record(input.response);
  const results = Array.isArray(payload.results) ? payload.results.map(record) : [];
  const safeCandidateUrls = [...new Set(results.flatMap((item) => [item.url, item.id]).map(normalizeStage4b2SourceIdentity).filter((value): value is string => Boolean(value)))];
  if (!results.length) return { ok: false as const, reason: "SOURCE_NOT_DISCOVERED" as Stage4b2SourceDiagnostic, safeCandidateUrls };
  const approvedIdentity = normalizeStage4b2SourceIdentity(STAGE4B2_APPROVED_SOURCE_URL)!;
  const exact = results.find((item) => {
    const resultUrl = normalizeStage4b2SourceIdentity(item.url);
    if (resultUrl !== approvedIdentity) return false;
    return !isUrlIdentity(item.id) || normalizeStage4b2SourceIdentity(item.id) === approvedIdentity;
  });
  if (!exact) return { ok: false as const, reason: "SOURCE_IDENTITY_MISMATCH" as Stage4b2SourceDiagnostic, safeCandidateUrls };
  const highlights = (Array.isArray(exact.highlights) ? exact.highlights : []).filter((value): value is string => typeof value === "string").map(compact).filter((value) => value.length >= 24);
  const document = compact(input.independentlyRetrievedText);
  const normalizedDocument = normalizeStage4b2VerbatimPassage(document);
  const passageDiagnostics = highlights.map((highlight) => {
    const normalized = normalizeStage4b2VerbatimPassage(highlight);
    const pdfEvidence = input.approvedPdfArtifact ? verifyStage4b2PdfPassage({ artifact: input.approvedPdfArtifact, passage: highlight }) : null;
    return {
      passageSha256: sha256(highlight), passageLength: highlight.length, normalizedLength: normalized.length,
      normalizedPassageSha256: sha256(normalized),
      compactExactMatch: document.includes(highlight), normalizedVerbatimMatch: normalizedDocument.includes(normalized),
      pdfV2Match: pdfEvidence?.ok === true,
      diagnosticOfficialRepresentationMatch: (input.diagnosticOfficialRepresentations ?? []).some((representation) => normalizeStage4b2VerbatimPassage(representation).includes(normalized)),
      pdfEvidence,
    };
  });
  const safeDiagnostics = {
    highlightCount: highlights.length, highlightLengths: passageDiagnostics.map((item) => item.passageLength),
    highlightSha256: passageDiagnostics.map((item) => item.passageSha256), originalTextLength: document.length,
    originalTextSha256: sha256(document), normalizedOriginalTextLength: normalizedDocument.length, normalizedOriginalTextSha256: sha256(normalizedDocument),
    matchingOutcomes: passageDiagnostics.map(({ passageSha256, normalizedPassageSha256, compactExactMatch, normalizedVerbatimMatch, pdfV2Match, diagnosticOfficialRepresentationMatch }) => ({ passageSha256, normalizedPassageSha256, compactExactMatch, normalizedVerbatimMatch, pdfV2Match, diagnosticOfficialRepresentationMatch })),
  };
  if (!highlights.length) return { ok: false as const, reason: "SOURCE_CONTENT_UNAVAILABLE" as Stage4b2SourceDiagnostic, safeCandidateUrls: [approvedIdentity], safeDiagnostics };
  const exactPassage = highlights.find((highlight) => document.includes(highlight));
  if (exactPassage) return { ok: true as const, sourceUrl: approvedIdentity, sourceIdentity: STAGE4B2_SOURCE_IDENTITY, evidenceRepresentation: "abstract" as const, representationUrl: STAGE4B2_APPROVED_ABSTRACT_URL, passage: exactPassage, passageSha256: sha256(exactPassage), matchMode: "compact_exact" as const, sourceDocumentFingerprint: sha256(document), safeCandidateUrls: [approvedIdentity], safeDiagnostics };
  const normalizedPassage = highlights.find((highlight) => normalizedDocument.includes(normalizeStage4b2VerbatimPassage(highlight)));
  if (normalizedPassage) return { ok: true as const, sourceUrl: approvedIdentity, sourceIdentity: STAGE4B2_SOURCE_IDENTITY, evidenceRepresentation: "abstract" as const, representationUrl: STAGE4B2_APPROVED_ABSTRACT_URL, passage: normalizedPassage, passageSha256: sha256(normalizedPassage), matchMode: "normalized_verbatim" as const, mismatchCategory: "text_normalization_mismatch_recovered" as const, sourceDocumentFingerprint: sha256(document), safeCandidateUrls: [approvedIdentity], safeDiagnostics };
  const pdfMatch = passageDiagnostics.find((item) => item.pdfEvidence?.ok === true)?.pdfEvidence;
  if (pdfMatch?.ok) return { ok: true as const, sourceUrl: approvedIdentity, passage: pdfMatch.passage, passageSha256: pdfMatch.passageSha256, matchMode: pdfMatch.matchMode, sourceIdentity: pdfMatch.sourceIdentity, evidenceRepresentation: pdfMatch.representation, representationUrl: pdfMatch.representationUrl, evidenceLocator: pdfMatch.locator, sourceDocumentFingerprint: pdfMatch.documentSha256, evidencePageFingerprint: pdfMatch.pageSha256, evidenceBlockFingerprint: pdfMatch.blockSha256, safeCandidateUrls: [approvedIdentity], safeDiagnostics };
  const scopeMismatch = passageDiagnostics.some((item) => item.diagnosticOfficialRepresentationMatch);
  return { ok: false as const, reason: (scopeMismatch ? "DOCUMENT_SCOPE_MISMATCH" : "SOURCE_PASSAGE_NOT_VERIFIED") as Stage4b2SourceDiagnostic, mismatchCategory: scopeMismatch ? "document_scope_mismatch" as const : "unresolved_passage_mismatch" as const, safeCandidateUrls: [approvedIdentity], safeDiagnostics };
}

export function validateStage4b2ClaimAssessment(input: { assessment: unknown; evidenceId: string }) {
  const assessment = record(input.assessment);
  return assessment.status === "supported" &&
    Array.isArray(assessment.evidenceIds) &&
    assessment.evidenceIds.length === 1 &&
    assessment.evidenceIds[0] === input.evidenceId;
}

export type Stage4b2ExecutionReceipt = {
  version: "stage4b2-execution-receipt-v1";
  executionId: string;
  approvedSourceUrl: typeof STAGE4B2_APPROVED_SOURCE_URL;
  state: "started" | "completed" | "blocked";
  startedAt: string | null;
  completedAt: string | null;
  providerUsage: { exaCalls: number; openAiCalls: number; reportedCostUsd: number | null; openAiInputTokens?: number; openAiOutputTokens?: number };
  result: string | null;
  elapsedMs?: number;
};

const validateExecutionId = (value: string) => {
  if (!/^stage4b2-[a-z0-9][a-z0-9-]{7,79}$/u.test(value)) throw new Error("EXECUTION_ID_INVALID");
  if (STAGE4B2_CONSUMED_EXECUTION_IDS.has(value)) throw new Error("EXECUTION_ALREADY_CONSUMED");
};

export async function claimStage4b2Execution(input: { executionId: string; approvedExecutionId: string; consent: string; receiptDirectory: string; now?: () => string }) {
  validateExecutionId(input.executionId);
  if (input.executionId !== input.approvedExecutionId || input.consent !== `confirmed:${input.executionId}`) throw new Error("EXECUTION_AUTHORIZATION_REQUIRED");
  await mkdir(input.receiptDirectory, { recursive: true, mode: 0o700 });
  const receiptPath = path.join(input.receiptDirectory, `${input.executionId}.json`);
  const startedAt = (input.now ?? (() => new Date().toISOString()))();
  const receipt: Stage4b2ExecutionReceipt = { version: "stage4b2-execution-receipt-v1", executionId: input.executionId, approvedSourceUrl: STAGE4B2_APPROVED_SOURCE_URL, state: "started", startedAt, completedAt: null, providerUsage: { exaCalls: 0, openAiCalls: 0, reportedCostUsd: null }, result: null };
  let handle;
  try { handle = await open(receiptPath, "wx", 0o600); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("EXECUTION_ALREADY_CONSUMED"); throw error; }
  await handle.writeFile(`${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await handle.sync();
  await handle.close();
  const complete = async (update: Pick<Stage4b2ExecutionReceipt, "state" | "providerUsage" | "result">) => {
    if (update.state === "started") throw new Error("EXECUTION_RECEIPT_STATE_INVALID");
    const current = JSON.parse(await readFile(receiptPath, "utf8")) as Stage4b2ExecutionReceipt;
    if (current.executionId !== input.executionId || current.state !== "started") throw new Error("EXECUTION_RECEIPT_CONFLICT");
    const completed: Stage4b2ExecutionReceipt = { ...current, ...update, completedAt: (input.now ?? (() => new Date().toISOString()))() };
    const temporaryPath = `${receiptPath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(completed, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(temporaryPath, receiptPath);
    return completed;
  };
  return { receipt, receiptPath, complete };
}
