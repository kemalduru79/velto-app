import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createCreatorScriptLiveAcceptanceBudget } from "@/lib/creator/creatorScriptLiveAcceptanceBudget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// This endpoint exists only on the temporary Stage 4B2 draft branch. It must
// never be merged into production. Revoke STAGE4B2_ONCE_TOKEN after one trial.
const SOURCE_URL = "https://arxiv.org/abs/2304.03442";
const QUERY = "Generative Agents Interactive Simulacra of Human Behavior arxiv 2304.03442 Joon Sung Park";
const RUN_ID = "synthetic-acceptance-stage4b2-agents-20261019";
const BUDGET_USD = 5;
const MODEL = "gpt-4.1-mini"; // provider wiring validation, not editorial-quality approval
let occupied = false;
let completed = false;

type TrialStage = { name: string; elapsedMs: number; result: "passed" | "blocked" };
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const norm = (s: string) => s.replace(/\s+/gu, " ").trim();
const canonical = (s: string) => { const url = new URL(s); url.hash = ""; return url.toString(); };
const safeError = (e: unknown) => e instanceof Error ? e.message.slice(0, 170) : "UNKNOWN";
const response = (value: unknown, status = 200) =>
  NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
function assertAuth(request: Request): boolean {
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== "agent/creatorlab-r2-stage4b2-provider-acceptance-prep") return false;
  const token = process.env.STAGE4B2_ONCE_TOKEN;
  const sent = request.headers.get("x-stage4b2-token");
  if (!token || token.length < 48 || !sent || sent.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(sent));
}
function htmlToPlain(html: string) {
  const stripped = html.replace(/<(?:script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\s*(?:script|style|nav|footer)>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&(?:nbsp|#160);/giu, " ").replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<").replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"').replace(/&#39;/giu, "'");
  return norm(stripped);
}
function outputJson(responseBody: any) {
  const raw = responseBody?.output_text ||
    responseBody?.output?.filter((item: any) => item.type === "message")
      .flatMap((item: any) => item.content || [])
      .filter((item: any) => item.type === "output_text")
      .map((item: any) => item.text).join("") || "";
  if (typeof raw !== "string" || !raw.trim()) throw new Error("OPENAI_EMPTY_JSON");
  try { return JSON.parse(raw); } catch { throw new Error("OPENAI_INVALID_JSON"); }
}

export async function POST(request: Request) {
  if (!assertAuth(request)) return response({ status: "BLOCKED", reason: "NOT_AUTHORIZED" }, 404);
  let body: any;
  try { body = await request.json(); } catch { return response({ status: "BLOCKED", reason: "INVALID_REQUEST" }, 400); }
  if (body?.runId !== RUN_ID || Object.keys(body).length !== 1) return response({ status: "BLOCKED", reason: "SCOPE_MISMATCH" }, 403);
  if (occupied || completed) return response({ status: "BLOCKED", reason: "ONCE_ONLY_IN_THIS_INSTANCE" }, 409);
  if (!process.env.EXA_API_KEY || !process.env.OPENAI_API_KEY) return response({ status: "BLOCKED", reason: "PROVIDER_CONFIG_MISSING" }, 503);
  occupied = true;
  const started = performance.now();
  const traces: TrialStage[] = [];
  const budget = createCreatorScriptLiveAcceptanceBudget({
    executionKind: "live", allowLiveProviders: true,
    approvedMaxCostUsd: BUDGET_USD, approvedMaxExaRequests: 1,
    approvedMaxOpenAiRequests: 3, approvedMaxOutputTokensPerRequest: 2200,
  });
  const timer = new AbortController();
  const hardLimit = setTimeout(() => timer.abort(), 240000);
  const stage = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const t = performance.now();
    if (timer.signal.aborted || performance.now() - started > 240000) throw new Error("ROUTE_TIME_LIMIT");
    try {
      const value = await fn();
      if (timer.signal.aborted) throw new Error("ROUTE_TIME_LIMIT");
      traces.push({ name, elapsedMs: Math.round(performance.now() - t), result: "passed" });
      return value;
    } catch (err) {
      traces.push({ name, elapsedMs: Math.round(performance.now() - t), result: "blocked" });
      throw err;
    }
  };
  const fetchJson = async (url: string, apiKey: string, headers: Record<string, string>, payload: object) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (timer.signal.aborted) throw new Error("ROUTE_TIME_LIMIT");
    timer.signal.addEventListener("abort", abort, { once: true });
    const alarm = setTimeout(abort, 55000);
    try {
      const r = await fetch(url, { method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload), signal: controller.signal, cache: "no-store", redirect: "error" });
      if (!r.ok) throw new Error("PROVIDER_HTTP_" + r.status);
      const text = await r.text();
      if (text.length > 300000) throw new Error("PROVIDER_RESPONSE_TOO_LARGE");
      return JSON.parse(text);
    } finally { clearTimeout(alarm); timer.signal.removeEventListener("abort", abort); }
  };
  const callOpenAI = async (kind: string, system: string, user: unknown) =>
    stage(kind, async () => {
      budget.reserve("openai", 1.45, 2200);
      const data = await fetchJson("https://api.openai.com/v1/responses", process.env.OPENAI_API_KEY!,
        { Authorization: "Bearer " + process.env.OPENAI_API_KEY! },
        { model: MODEL, input: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(user) }],
          text: { format: { type: "json_object" } }, max_output_tokens: 2200 });
      const usage = data.usage || {};
      const inputTokens = usage.input_tokens, outputTokens = usage.output_tokens;
      if (!Number.isSafeInteger(inputTokens) || !Number.isSafeInteger(outputTokens)) throw new Error("OPENAI_USAGE_MISSING");
      // 4.1-mini standard token price used as estimate; final provider charges may vary.
      const costUsd = inputTokens * 0.40 / 1000000 + outputTokens * 1.60 / 1000000;
      budget.record({ provider: "openai", requestId: typeof data.id === "string" ? data.id : null,
        inputTokens, outputTokens, estimatedCostUsd: 1.45, reportedCostUsd: costUsd });
      if (budget.report().costLimitExceeded) throw new Error("BUDGET_EXCEEDED");
      return outputJson(data);
    });
  try {
    const exa = await stage("exa_research", async () => {
      budget.reserve("exa", 0.50, 2200);
      const data = await fetchJson("https://api.exa.ai/search", process.env.EXA_API_KEY!,
        { "x-api-key": process.env.EXA_API_KEY! },
        { query: QUERY, type: "auto", numResults: 3, includeDomains: ["arxiv.org"], contents: { highlights: true } });
      const cost = data.costDollars?.total;
      if (!Number.isFinite(cost) || cost < 0) throw new Error("EXA_COST_REPORT_MISSING");
      budget.record({ provider: "exa", requestId: typeof data.requestId === "string" ? data.requestId : null,
        inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0.50, reportedCostUsd: cost });
      if (budget.report().costLimitExceeded) throw new Error("BUDGET_EXCEEDED");
      return data;
    });
    const approvedResults = Array.isArray(exa.results) ? exa.results.filter((s: any) => {
      try { return canonical(s.url) === SOURCE_URL; } catch { return false; }
    }) : [];
    if (!approvedResults.length) throw new Error("APPROVED_ARXIV_SOURCE_NOT_RETURNED");
    const highlights = approvedResults[0].highlights;
    if (!Array.isArray(highlights) || !highlights.length) throw new Error("EXA_NO_SOURCE_HIGHLIGHTS");
    const source = await stage("independent_original_source", async () => {
      const r = await fetch(SOURCE_URL, { signal: timer.signal, redirect: "error", cache: "no-store" });
      if (!r.ok || !String(r.headers.get("content-type")).includes("text/html")) throw new Error("ORIGINAL_SOURCE_UNAVAILABLE");
      const html = await r.text();
      if (html.length > 2000000 || !html.includes("Generative Agents")) throw new Error("ORIGINAL_SOURCE_INVALID");
      const text = htmlToPlain(html);
      const passages = highlights.filter((s: unknown) => typeof s === "string")
        .map((s: string) => norm(s)).filter((s: string) => s.length >= 24 && text.includes(s));
      if (!passages.length) throw new Error("EXA_PASSAGE_NOT_VERIFIED_IN_SOURCE");
      return { passage: passages[0], documentFingerprint: sha256(html), contentLength: html.length,
        passageDigest: sha256(passages[0]), passageOffset: text.indexOf(passages[0]) };
    });
    const before = [
      { id: "opening", kind: "opening", text: "People increasingly interact with software that speaks and responds like a person." },
      { id: "body-1", kind: "body", text: "It remains difficult to separate convincing simulations from observations of human social life." },
      { id: "body-2", kind: "body", text: "A simulated conversation can look consistent while leaving deeper questions unresolved." },
      { id: "body-3", kind: "body", text: "Any research finding must be interpreted within its measured limits." },
      { id: "conclusion", kind: "conclusion", text: "The challenge is to ask what our observations actually support." },
    ];
    const rewrite = await callOpenAI("openai_rewrite",
      "Revise only the body-1 section of a synthetic documentary. Return JSON {bodyText:string,claimText:string}. Make an evidence-specific change based ONLY on the supplied verified research passage; preserve uncertainty. Do not invent studies, samples, or causal results.",
      { topic: "Can AI agents simulate social behavior?", passage: source.passage, originalBody: before[1].text });
    if (typeof rewrite.bodyText !== "string" || rewrite.bodyText.length < 40 || rewrite.bodyText.length > 1600 ||
        typeof rewrite.claimText !== "string" || rewrite.claimText.length < 15 || rewrite.claimText.length > 450) throw new Error("REWRITE_INVALID");
    const claim = await callOpenAI("openai_claim_assessment",
      "Independently evaluate whether a claim is substantively entailed by the original-source passage. Output JSON {status:'supported'|'unsupported'|'contradicted',evidenceIds:string[],reason:string}. An exact keyword overlap is insufficient.",
      { claim: rewrite.claimText, evidence: { evidenceId: "approved-passage-1", passage: source.passage, url: SOURCE_URL } });
    if (claim.status !== "supported" || !Array.isArray(claim.evidenceIds) || claim.evidenceIds.length !== 1 ||
        claim.evidenceIds[0] !== "approved-passage-1") throw new Error("CLAIM_NOT_INDEPENDENTLY_SUPPORTED");
    const goal = await callOpenAI("openai_editorial_goal_assessment",
      "Independently assess whether the revised text adds a specific, grounded research insight while preserving uncertainty. Return JSON {status:'satisfied'|'blocked',reason:string}. Do not assume success.",
      { before: before[1].text, after: rewrite.bodyText, verifiedPassage: source.passage });
    if (goal.status !== "satisfied") throw new Error("EDITORIAL_GOAL_UNSATISFIED");
    const preview = before.map(s => s.id === "body-1" ? { ...s, text: rewrite.bodyText } : s);
    completed = true;
    return response({ status: "REVIEW_REQUIRED", previewOnly: true, applyPerformed: false,
      source: { url: SOURCE_URL, ...source }, preview,
      providerModel: MODEL, budget: budget.report(), elapsedMs: Math.round(performance.now() - started), traces,
      note: "Controlled provider smoke test only; not the canonical full-script executor or a production release gate." });
  } catch (error) {
    completed = true;
    return response({ status: "BLOCKED", reason: safeError(error), applyPerformed: false,
      providerModel: MODEL, budget: budget.report(), elapsedMs: Math.round(performance.now() - started), traces });
  } finally { clearTimeout(hardLimit); occupied = false; }
}
