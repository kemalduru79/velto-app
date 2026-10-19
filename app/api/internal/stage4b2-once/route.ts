import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createCreatorScriptLiveAcceptanceBudget } from "@/lib/creator/creatorScriptLiveAcceptanceBudget";
import { acquireOriginalSourceDocument } from "@/lib/research/originalSourceAcquisition.server";
import { verifyOriginalSourceEvidence } from "@/lib/research/originalSourceEvidence";
import type { ResearchSource } from "@/lib/research/sourceContract";
import type { ResearchEvidence } from "@/lib/research/claimEvidenceGraph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Isolated temporary Preview-only smoke route. NOT the canonical refinement
// executor, not an Apply route. Never merge into a production release.
const APPROVED_URL = "https://arxiv.org/abs/2304.03442";
const RESEARCH_QUERY = "Generative Agents Interactive Simulacra of Human Behavior arxiv 2304.03442 Joon Sung Park";
const RUN_ID = "synthetic-acceptance-stage4b2-agents-20261019";
const MODEL = "gpt-4.1-mini";
const TOTAL_BUDGET_USD = 5;
const PASSAGE_ID = "accepted-arxiv-passage-1";
let occupied = false;
let completed = false;

type Stage = { name: string; elapsedMs: number; outcome: "completed" | "blocked" };
const asObject = (input: unknown): Record<string, unknown> =>
  input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
const digest = (input: string) => createHash("sha256").update(input).digest("hex");
const compact = (input: string) => input.replace(/\s+/gu, " ").trim();
const fail = (code: string): never => { throw new Error(code); };
const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const sameUrl = (value: string) => {
  try { const url = new URL(value); url.hash = ""; return url.toString() === APPROVED_URL; }
  catch { return false; }
};

function authenticated(request: Request) {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "agent/creatorlab-r2-stage4b2-provider-acceptance-prep" ||
      process.env.STAGE4B2_ENABLE_LIVE !== "approved-single-trial") return false;
  const expiry = Date.parse(process.env.STAGE4B2_EXPIRES_UTC || "");
  if (!Number.isFinite(expiry) || expiry <= Date.now()) return false;
  const expected = process.env.STAGE4B2_ONCE_TOKEN;
  const actual = request.headers.get("x-stage4b2-once-token");
  if (!expected || expected.length < 32 || !actual || actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

function documentText(html: string) {
  return compact(html
    .replace(/<(?:script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\s*(?:script|style|nav|footer)>/giu, " ")
    .replace(/<[^>]*>/gu, " ")
    .replace(/&#(\d+);/gu, (_match, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos);/gu,
      (entity) => ({ "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" }[entity] || entity)));
}

export async function POST(request: Request) {
  if (!authenticated(request)) return reply({ status: "BLOCKED", code: "UNAUTHORIZED" }, 404);
  let body: Record<string, unknown>;
  try { body = asObject(await request.json()); }
  catch { return reply({ status: "BLOCKED", code: "INVALID_BODY" }, 400); }
  if (Object.keys(body).length !== 1 || body.runId !== RUN_ID) return reply({ status: "BLOCKED", code: "SCOPE_INVALID" }, 403);
  if (occupied || completed) return reply({ status: "BLOCKED", code: "ALREADY_STARTED" }, 409);
  if (!process.env.EXA_API_KEY || !process.env.OPENAI_API_KEY) return reply({ status: "BLOCKED", code: "PROVIDER_SECRET_MISSING" }, 503);
  occupied = true;
  completed = true; // One attempt per warm instance, even if it fails.
  const started = performance.now();
  const stages: Stage[] = [];
  const totalAbort = new AbortController();
  const timer = setTimeout(() => totalAbort.abort(), 225000);
  const budget = createCreatorScriptLiveAcceptanceBudget({
    executionKind: "live", allowLiveProviders: true, approvedMaxCostUsd: TOTAL_BUDGET_USD,
    approvedMaxExaRequests: 1, approvedMaxOpenAiRequests: 3, approvedMaxOutputTokensPerRequest: 1050,
  });

  const stage = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const start = performance.now();
    if (totalAbort.signal.aborted) fail("TOTAL_TIMEOUT");
    try {
      const result = await fn();
      if (totalAbort.signal.aborted) fail("TOTAL_TIMEOUT");
      stages.push({ name, elapsedMs: Math.round(performance.now() - start), outcome: "completed" });
      return result;
    } catch (error) {
      stages.push({ name, elapsedMs: Math.round(performance.now() - start), outcome: "blocked" });
      throw error;
    }
  };
  const postJson = async (url: string, apiKey: string, authorization: "openai" | "exa", payload: unknown) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const timeout = setTimeout(abort, 40000);
    totalAbort.signal.addEventListener("abort", abort, { once: true });
    try {
      const headers = new Headers({ "Content-Type": "application/json" });
      if (authorization === "exa") headers.set("x-api-key", apiKey);
      else headers.set("Authorization", `Bearer ${apiKey}`);
      const result = await fetch(url, { method: "POST", headers,
        body: JSON.stringify(payload), signal: controller.signal, cache: "no-store", redirect: "error" });
      if (!result.ok) fail(authorization.toUpperCase() + "_HTTP_" + result.status);
      const text = await result.text();
      if (text.length > 250000) fail("PROVIDER_OUTPUT_TOO_LARGE");
      return asObject(JSON.parse(text));
    } finally { clearTimeout(timeout); totalAbort.signal.removeEventListener("abort", abort); }
  };
  const openAI = async (name: string, system: string, input: unknown) =>
    stage(name, async () => {
      budget.reserve("openai", 1.25, 1050);
      const result = await postJson("https://api.openai.com/v1/responses", process.env.OPENAI_API_KEY!,
        "openai", { model: MODEL, input: [{ role: "system", content: system },
          { role: "user", content: JSON.stringify(input) }],
          text: { format: { type: "json_object" } }, max_output_tokens: 1050 });
      const usage = asObject(result.usage);
      if (!Number.isSafeInteger(usage.input_tokens) || !Number.isSafeInteger(usage.output_tokens)) fail("OPENAI_USAGE_UNKNOWN");
      budget.record({ provider: "openai", requestId: typeof result.id === "string" ? result.id : null,
        inputTokens: usage.input_tokens as number, outputTokens: usage.output_tokens as number,
        estimatedCostUsd: 1.25, reportedCostUsd: null });
      const parts = Array.isArray(result.output) ? result.output : [];
      const content = parts.flatMap((item: unknown) => {
        const c = asObject(item).content;
        return Array.isArray(c) ? c : [];
      });
      const outputText = typeof result.output_text === "string" ? result.output_text :
        content.map((item: unknown) => asObject(item).text).filter((s): s is string => typeof s === "string").join("");
      if (!outputText.trim()) fail("OPENAI_EMPTY_OUTPUT");
      try { return asObject(JSON.parse(outputText)); }
      catch { return fail("OPENAI_OUTPUT_INVALID_JSON"); }
    });

  try {
    const exa = await stage("exa_search", async () => {
      budget.reserve("exa", 0.75, 1050);
      const result = await postJson("https://api.exa.ai/search", process.env.EXA_API_KEY!,
        "exa", { query: RESEARCH_QUERY, type: "auto", numResults: 3,
          includeDomains: ["arxiv.org"], contents: { highlights: true } });
      const cost = asObject(result.costDollars).total;
      if (typeof cost !== "number" || !Number.isFinite(cost) || cost < 0) throw new Error("EXA_COST_UNKNOWN");
      if (cost > 0.75) throw new Error("EXA_COST_EXCEEDS_RESERVED_ESTIMATE");
      budget.record({ provider: "exa", requestId: typeof result.requestId === "string" ? result.requestId : null,
        inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0.75, reportedCostUsd: cost });
      if (budget.report().costLimitExceeded) fail("BUDGET_EXCEEDED");
      return result;
    });
    const approved = (Array.isArray(exa.results) ? exa.results : []).map(asObject)
      .find((result) => typeof result.url === "string" && sameUrl(result.url));
    if (!approved) throw new Error("APPROVED_SOURCE_NOT_RETURNED");
    const highlights = Array.isArray(approved.highlights) ? approved.highlights : [];
    const source: ResearchSource = {
      sourceId: "academic:arxiv-2304.03442", adapterId: "academic", mediaKind: "paper",
      externalId: APPROVED_URL, title: typeof approved.title === "string" ? approved.title : "Generative Agents",
      url: APPROVED_URL, publisher: "arXiv", author: null, publishedAt: null,
      language: "en", summary: null, thumbnailUrl: null, durationSec: null, metrics: {}, sourceMetadata: {},
    };
    const acquisition = await stage("independent_source_acquisition", async () =>
      acquireOriginalSourceDocument({ source, authority: "original_research", signal: totalAbort.signal,
        maxBytes: 1800000, timeoutMs: 12000, maxRedirects: 0 }));
    const originalHtml = acquisition.document.content;
    const extracted = documentText(originalHtml);
    const matchingPassage = highlights
      .filter((v: unknown): v is string => typeof v === "string")
      .map(compact).find((v: string) => v.length >= 24 && extracted.includes(v));
    if (!matchingPassage) throw new Error("NO_EXACT_ORIGINAL_PASSAGE");
    const evidence: ResearchEvidence = { evidenceId: PASSAGE_ID, sourceId: source.sourceId,
      excerpt: matchingPassage, contextNote: null,
      locator: { section: "exa-highlight:1", page: null, timecodeStartSec: null, timecodeEndSec: null } };
    const verified = verifyOriginalSourceEvidence({ source, evidence,
      document: { sourceId: source.sourceId, url: APPROVED_URL, content: extracted,
        acquisition: "trusted_fetch", authority: "original_research", expectedSha256: digest(extracted) } });
    if (verified.state !== "source_verified") fail("SOURCE_EVIDENCE_NOT_VERIFIED");
    const initial = [
      { id: "opening", kind: "opening", text: "Artificial agents increasingly produce dialogue that seems socially convincing." },
      { id: "body-1", kind: "body", text: "A social simulation is not automatically evidence that the same processes occur in people." },
      { id: "body-2", kind: "body", text: "The design of an experiment shapes what simulated behavior can establish." },
      { id: "body-3", kind: "body", text: "Claims about social behavior require evidence tied to observations." },
      { id: "conclusion", kind: "conclusion", text: "How much can a convincing simulation really tell us about human life?" },
    ];
    const rewrite = await openAI("openai_rewrite",
      "Respond with strict JSON containing bodyText and claimText. Revise this synthetic documentary body paragraph based solely on the cited original passage. Do not invent numerical, causal or generalized findings. Preserve uncertainty.",
      { passage: matchingPassage, originalBody: initial[1].text, source: APPROVED_URL });
    if (typeof rewrite.bodyText !== "string" || rewrite.bodyText.length < 55 || rewrite.bodyText.length > 1000 ||
        typeof rewrite.claimText !== "string" || rewrite.claimText.length < 20 || rewrite.claimText.length > 500) fail("REWRITE_INVALID");
    const assessment = await openAI("openai_claim_check",
      "Evaluate whether the cited passage substantively supports the proposed claim. Respond strict JSON: status=supported|unsupported|contradicted, evidenceIds=array, reason=string. Only list an evidenceId if it actually supports the claim.",
      { claim: rewrite.claimText, evidenceId: PASSAGE_ID, passage: matchingPassage });
    if (assessment.status !== "supported" || !Array.isArray(assessment.evidenceIds) ||
        assessment.evidenceIds.length !== 1 || assessment.evidenceIds[0] !== PASSAGE_ID) fail("CLAIM_NOT_SUPPORTED");
    const editorial = await openAI("openai_goal_check",
      "Independently assess whether the revised body adds attributable, evidence-grounded explanatory detail and preserves uncertainty. Strict JSON: status=satisfied|blocked, reason=string.",
      { before: initial[1].text, after: rewrite.bodyText, passage: matchingPassage });
    if (editorial.status !== "satisfied") fail("EDITORIAL_GOAL_BLOCKED");
    const preview = initial.map((item) => item.id === "body-1" ? { ...item, text: rewrite.bodyText } : item);
    return reply({
      status: "REVIEW_REQUIRED", // Smoke success is NOT the full canonical executor acceptance.
      smokeTestResult: "PROVIDER_PIPELINE_PASS", previewOnly: true, applyPerformed: false,
      source: { url: APPROVED_URL, originalDocumentSha256: acquisition.provenance.sha256,
        verifiedPassageSha256: verified.passageDigest, passageLocator: verified.locator },
      model: MODEL, preview, budget: budget.report(), elapsedMs: Math.round(performance.now() - started), stages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return reply({ status: "BLOCKED", reason: message.slice(0,180), applyPerformed: false,
      model: MODEL, budget: budget.report(), elapsedMs: Math.round(performance.now() - started), stages });
  } finally {
    clearTimeout(timer);
    occupied = false;
  }
}
