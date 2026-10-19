/** Stage 4B2 isolated, synthetic, Preview-only provider probe. No persistence or Apply. */
import { createHash } from "node:crypto";
import path from "node:path";
import {
  STAGE4B2_APPROVED_SOURCE_URL as SOURCE_URL,
  STAGE4B2_CONTENTS_ENDPOINT as EXA_URL,
  claimStage4b2Execution,
  classifyStage4b2ContentsResponse,
  validateStage4b2ClaimAssessment,
} from "../lib/creator/stage4b2ProviderAcceptance.ts";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-4.1-mini";
const TOTAL_BUDGET_USD = 5;
const EXA_RESERVATION = 0.75;
const OPENAI_RESERVATION = 1.25;
const OUTPUT_LIMIT = 1050;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const compact = (value) => value.replace(/\s+/gu, " ").trim();
const toRecord = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const scenes = Array.from({ length: 36 }, (_unused, index) => ({ id: `synthetic-scene-${index + 1}` }));
const script = [
  { id: "opening", text: "Artificial agents increasingly produce dialogue that appears socially convincing." },
  { id: "body-1", text: "A compelling simulation is not evidence that the same processes occur in people." },
  { id: "body-2", text: "An experiment's design determines which observations it can substantiate." },
  { id: "body-3", text: "Social behavior claims require accountable evidence and stated limitations." },
  { id: "conclusion", text: "What can a convincing simulation actually tell us about human life?" },
];
const before = sha256(JSON.stringify({ script, scenes }));
const usage = { exaCalls: 0, openAiCalls: 0, estimatedReservedUsd: 0, exaReportedUsd: null, openAiReportedUsd: null };
const steps = [];
const report = (status, fields = {}) => ({
  stage: "4B2", status, previewOnly: true, applyPerformed: false, synthetic: true,
  model: MODEL, approvedSource: SOURCE_URL, approvedMaxCostUsd: TOTAL_BUDGET_USD,
  ...usage, zeroWriteProof: { before, after: sha256(JSON.stringify({ script, scenes })), unchanged: before === sha256(JSON.stringify({ script, scenes })) }, steps, ...fields,
});
const reserve = (kind, amount) => {
  if (usage.estimatedReservedUsd + amount > TOTAL_BUDGET_USD) throw new Error("BUDGET_EXHAUSTED");
  if (kind === "exa" && usage.exaCalls >= 1) throw new Error("EXA_LIMIT_EXHAUSTED");
  if (kind === "openai" && usage.openAiCalls >= 3) throw new Error("OPENAI_LIMIT_EXHAUSTED");
  usage.estimatedReservedUsd += amount;
  if (kind === "exa") usage.exaCalls += 1; else usage.openAiCalls += 1;
};
const textOfHtml = (html) => compact(html
  .replace(/<(?:script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\s*(?:script|style|nav|footer)>/giu, " ")
  .replace(/<[^>]*>/gu, " ")
  .replace(/&#(\d+);/gu, (match, number) => Number(number) <= 0x10ffff ? String.fromCodePoint(Number(number)) : match)
  .replace(/&(?:nbsp|amp|lt|gt|quot|apos);/gu, (match) => ({ "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&apos;": "'" }[match] || match)));

const executionId = process.env.STAGE4B2_EXECUTION_ID || "";
const approvedExecutionId = process.env.STAGE4B2_APPROVED_EXECUTION_ID || "";
const consent = process.env.STAGE4B2_EXECUTION_CONSENT || "";
const authorized = process.argv.includes("--execute") && executionId && approvedExecutionId && consent === `confirmed:${executionId}`;

if (!authorized) {
  console.log(JSON.stringify(report("REVIEW_REQUIRED", {
    reason: "DRY_RUN_ONLY",
    instructions: "A future run requires --execute and a newly approved matching execution ID, approved execution ID and confirmed:<execution-id> consent.",
  }), null, 2));
} else {
  const started = performance.now();
  const overallAbort = AbortSignal.timeout(180000);
  let receiptAuthority;
  const step = async (name, operation) => {
    const start = performance.now();
    try {
      const result = await operation();
      if (overallAbort.aborted) throw new Error("TOTAL_TIME_BUDGET_EXCEEDED");
      steps.push({ name, durationMs: Math.round(performance.now() - start), status: "completed" });
      return result;
    } catch (error) {
      steps.push({ name, durationMs: Math.round(performance.now() - start), status: "blocked" });
      throw error;
    }
  };
  const network = async (url, options) => {
    const response = await fetch(url, { ...options, redirect: "error", signal: AbortSignal.any([overallAbort, AbortSignal.timeout(35000)]) });
    if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
    const raw = await response.text();
    if (raw.length > 500000) throw new Error("PROVIDER_RESPONSE_TOO_LARGE");
    return raw;
  };
  const parseJson = (raw) => { try { return JSON.parse(raw); } catch { throw new Error("PROVIDER_RESPONSE_MALFORMED"); } };
  const callOpenAI = async (name, system, user) => step(name, async () => {
    reserve("openai", OPENAI_RESERVATION);
    const data = toRecord(parseJson(await network(OPENAI_URL, { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: MODEL, input: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(user) }], text: { format: { type: "json_object" } }, max_output_tokens: OUTPUT_LIMIT }),
    })));
    const tokens = toRecord(data.usage);
    if (!Number.isSafeInteger(tokens.input_tokens) || !Number.isSafeInteger(tokens.output_tokens) || tokens.output_tokens > OUTPUT_LIMIT) throw new Error("OPENAI_USAGE_INVALID");
    const items = Array.isArray(data.output) ? data.output : [];
    const contents = items.flatMap((item) => Array.isArray(toRecord(item).content) ? toRecord(item).content : []);
    const output = typeof data.output_text === "string" ? data.output_text : contents.map((item) => toRecord(item).text).filter((value) => typeof value === "string").join("");
    if (!output.trim()) throw new Error("OPENAI_OUTPUT_EMPTY");
    return toRecord(parseJson(output));
  });
  try {
    if (!process.env.EXA_API_KEY || !process.env.OPENAI_API_KEY) throw new Error("LOCAL_PROVIDER_KEYS_MISSING");
    receiptAuthority = await claimStage4b2Execution({ executionId, approvedExecutionId, consent, receiptDirectory: process.env.STAGE4B2_RECEIPT_DIR || path.resolve(".stage4b2-receipts") });
    const exa = await step("exa_exact_source_contents", async () => {
      reserve("exa", EXA_RESERVATION);
      const data = toRecord(parseJson(await network(EXA_URL, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": process.env.EXA_API_KEY }, body: JSON.stringify({
        ids: [SOURCE_URL], highlights: { query: "agent behavior simulation evidence limitations", maxCharacters: 4000 },
      }) })));
      const cost = toRecord(data.costDollars).total;
      if (typeof cost !== "number" || !Number.isFinite(cost) || cost < 0) throw new Error("EXA_COST_UNKNOWN");
      usage.exaReportedUsd = cost;
      if (cost > EXA_RESERVATION) throw new Error("EXA_ESTIMATED_COST_EXCEEDED");
      return data;
    });
    const raw = await step("independent_original_source", () => network(SOURCE_URL, { method: "GET", headers: { Accept: "text/html" } }));
    const extracted = textOfHtml(raw);
    const sourceResult = classifyStage4b2ContentsResponse({ response: exa, independentlyRetrievedText: extracted });
    if (!sourceResult.ok) { const error = new Error(sourceResult.reason); error.safeCandidateUrls = sourceResult.safeCandidateUrls; throw error; }
    const evidence = { id: "e-approved", passage: sourceResult.passage, sourceUrl: sourceResult.sourceUrl, passageSha256: sourceResult.passageSha256 };
    const revised = await callOpenAI("rewrite", "Return JSON {bodyText:string,claimText:string}. Revise only the synthetic body paragraph using this exact attributed passage. No invented results or causation.", { original: script[1].text, evidence });
    if (typeof revised.bodyText !== "string" || revised.bodyText.length < 55 || revised.bodyText.length > 1200 || typeof revised.claimText !== "string" || revised.claimText.length < 20 || revised.claimText.length > 500) throw new Error("REWRITE_INVALID");
    const assessed = await callOpenAI("independent_claim_assessment", "Return JSON {status:'supported'|'unsupported'|'contradicted',evidenceIds:string[],reason:string}. Require substantive support from the exact evidence ID.", { claim: revised.claimText, evidence });
    if (!validateStage4b2ClaimAssessment({ assessment: assessed, evidenceId: evidence.id })) throw new Error("CLAIM_UNSUPPORTED");
    const goal = await callOpenAI("editorial_goal_assessment", "Return JSON {status:'satisfied'|'blocked',reason:string}. Do not presume success.", { before: script[1].text, after: revised.bodyText, passage: sourceResult.passage });
    if (goal.status !== "satisfied") throw new Error("EDITORIAL_GOAL_UNSATISFIED");
    await receiptAuthority.complete({ state: "completed", providerUsage: { exaCalls: usage.exaCalls, openAiCalls: usage.openAiCalls, reportedCostUsd: usage.exaReportedUsd }, result: "REVIEW_REQUIRED" });
    console.log(JSON.stringify(report("REVIEW_REQUIRED", { executionId, providerSmokeTest: "PASS", actualElapsedMs: Math.round(performance.now() - started), sourceDocumentSha256: sha256(raw), verifiedPassageSha256: sourceResult.passageSha256, passageStartOffset: extracted.indexOf(sourceResult.passage), preview: script.map((section) => section.id === "body-1" ? { ...section, text: revised.bodyText } : section), limitation: "Real provider smoke, not canonical whole-script refinement acceptance." }), null, 2));
  } catch (error) {
    let reason = error instanceof Error ? error.message : "UNKNOWN";
    if (receiptAuthority) {
      try { await receiptAuthority.complete({ state: "blocked", providerUsage: { exaCalls: usage.exaCalls, openAiCalls: usage.openAiCalls, reportedCostUsd: usage.exaReportedUsd }, result: reason }); }
      catch (receiptError) { reason = `EXECUTION_RECEIPT_FINALIZATION_FAILED:${receiptError instanceof Error ? receiptError.message : "UNKNOWN"}`; }
    }
    console.log(JSON.stringify(report("BLOCKED", { executionId, actualElapsedMs: Math.round(performance.now() - started), reason, safeCandidateUrls: Array.isArray(error?.safeCandidateUrls) ? error.safeCandidateUrls : undefined }), null, 2));
    process.exitCode = 1;
  }
}
