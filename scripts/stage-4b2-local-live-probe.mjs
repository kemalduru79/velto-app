/**
 * Stage 4B2 isolated local provider smoke test.
 * Opt-in only: never called from a production route or the critical suite in live mode.
 * Synthetic script only; no persistence, no Apply, no scene/video/media writes.
 *
 * Dry-run: node scripts/stage-4b2-local-live-probe.mjs
 * Authorized local run:
 * STAGE4B2_EXECUTION_CONSENT=confirmed-5usd-arxiv2304 node --env-file=.env.local scripts/stage-4b2-local-live-probe.mjs --execute
 */
import { createHash } from "node:crypto";

const URL = "https://arxiv.org/abs/2304.03442";
const EXA_URL = "https://api.exa.ai/search";
const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-4.1-mini";
const APPROVAL = "confirmed-5usd-arxiv2304";
const TOTAL_BUDGET_USD = 5;
const EXA_RESERVATION = 0.75;
const OPENAI_RESERVATION = 1.25;
const OUTPUT_LIMIT = 1050;
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const compact = (s) => s.replace(/\s+/gu, " ").trim();
const toRecord = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : {};
const scenes = Array.from({ length: 36 }, (_unused, i) => ({ id: `synthetic-scene-${i + 1}` }));
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
  stage: "4B2", status, previewOnly: true, applyPerformed: false,
  synthetic: true, model: MODEL, approvedSource: URL, approvedMaxCostUsd: TOTAL_BUDGET_USD,
  ...usage, zeroWriteProof: { before, after: sha256(JSON.stringify({ script, scenes })),
    unchanged: before === sha256(JSON.stringify({ script, scenes })) }, steps, ...fields,
});
const reserve = (kind, amount) => {
  if (usage.estimatedReservedUsd + amount > TOTAL_BUDGET_USD) throw new Error("BUDGET_EXHAUSTED");
  if (kind === "exa" && usage.exaCalls >= 1) throw new Error("EXA_LIMIT_EXHAUSTED");
  if (kind === "openai" && usage.openAiCalls >= 3) throw new Error("OPENAI_LIMIT_EXHAUSTED");
  usage.estimatedReservedUsd += amount;
  if (kind === "exa") usage.exaCalls += 1;
  else usage.openAiCalls += 1;
};
const textOfHtml = (html) => compact(html
  .replace(/<(?:script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\s*(?:script|style|nav|footer)>/giu, " ")
  .replace(/<[^>]*>/gu, " ")
  .replace(/&#(\d+);/gu, (s, n) => Number(n) <= 0x10ffff ? String.fromCodePoint(Number(n)) : s)
  .replace(/&(?:nbsp|amp|lt|gt|quot|apos);/gu, (s) =>
    ({ "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" }[s] || s)));
const isSource = (value) => {
  try { const u = new URL(value); u.hash = ""; return u.toString() === URL; }
  catch { return false; }
};

if (process.argv.includes("--execute") && process.env.STAGE4B2_EXECUTION_CONSENT === APPROVAL) {
  const started = performance.now();
  const overallAbort = AbortSignal.timeout(180000);
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
    const signal = AbortSignal.any([overallAbort, AbortSignal.timeout(35000)]);
    const res = await fetch(url, { ...options, redirect: "error", signal });
    if (!res.ok) throw new Error("PROVIDER_HTTP_" + res.status);
    const raw = await res.text();
    if (raw.length > 500000) throw new Error("PROVIDER_RESPONSE_TOO_LARGE");
    return raw;
  };
  const callOpenAI = async (name, system, user) => step(name, async () => {
    reserve("openai", OPENAI_RESERVATION);
    const data = toRecord(JSON.parse(await network(OPENAI_URL, { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: MODEL, input: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) },
      ], text: { format: { type: "json_object" } }, max_output_tokens: OUTPUT_LIMIT }),
    })));
    const tokens = toRecord(data.usage);
    if (!Number.isSafeInteger(tokens.input_tokens) || !Number.isSafeInteger(tokens.output_tokens) ||
        tokens.output_tokens > OUTPUT_LIMIT) throw new Error("OPENAI_USAGE_INVALID");
    const items = Array.isArray(data.output) ? data.output : [];
    const contents = items.flatMap((item) => Array.isArray(toRecord(item).content) ? toRecord(item).content : []);
    const output = typeof data.output_text === "string" ? data.output_text :
      contents.map((item) => toRecord(item).text).filter((v) => typeof v === "string").join("");
    if (!output.trim()) throw new Error("OPENAI_OUTPUT_EMPTY");
    return toRecord(JSON.parse(output));
  });
  try {
    if (!process.env.EXA_API_KEY || !process.env.OPENAI_API_KEY) throw new Error("LOCAL_PROVIDER_KEYS_MISSING");
    const exa = await step("exa_research", async () => {
      reserve("exa", EXA_RESERVATION);
      const data = toRecord(JSON.parse(await network(EXA_URL, { method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.EXA_API_KEY },
        body: JSON.stringify({
          query: "Generative Agents Interactive Simulacra of Human Behavior arxiv 2304.03442 Joon Sung Park",
          type: "auto", numResults: 3, includeDomains: ["arxiv.org"], contents: { highlights: true },
        }),
      })));
      const exaCost = toRecord(data.costDollars).total;
      if (typeof exaCost !== "number" || !Number.isFinite(exaCost) || exaCost < 0) throw new Error("EXA_COST_UNKNOWN");
      usage.exaReportedUsd = exaCost;
      if (exaCost > EXA_RESERVATION) throw new Error("EXA_ESTIMATED_COST_EXCEEDED");
      return data;
    });
    const original = (Array.isArray(exa.results) ? exa.results : [])
      .map(toRecord).find((item) => typeof item.url === "string" && isSource(item.url));
    if (!original) throw new Error("APPROVED_SOURCE_NOT_RETURNED");
    const raw = await step("original_source", async () =>
      network(URL, { method: "GET", headers: { Accept: "text/html" } }));
    const extracted = textOfHtml(raw);
    const verified = (Array.isArray(original.highlights) ? original.highlights : [])
      .filter((v) => typeof v === "string").map(compact)
      .find((v) => v.length >= 24 && extracted.includes(v));
    if (!verified) throw new Error("EXA_HIGHLIGHT_NOT_IN_APPROVED_ORIGINAL_SOURCE");
    const evidence = { id: "e-approved", passage: verified, sourceUrl: URL };
    const revised = await callOpenAI("rewrite", "Return JSON {bodyText:string,claimText:string}. Revise only the synthetic body paragraph using this exact attributed passage. No invented results or causation.",
      { original: script[1].text, evidence });
    if (typeof revised.bodyText !== "string" || revised.bodyText.length < 55 || revised.bodyText.length > 1200 ||
        typeof revised.claimText !== "string" || revised.claimText.length < 20 || revised.claimText.length > 500)
      throw new Error("REWRITE_INVALID");
    const assessed = await callOpenAI("independent_claim_assessment",
      "Return JSON {status:'supported'|'unsupported'|'contradicted',evidenceIds:string[],reason:string}. Assess whether the passage substantively supports the claimed assertion. Never accept keyword overlap alone.",
      { claim: revised.claimText, evidence });
    if (assessed.status !== "supported" || !Array.isArray(assessed.evidenceIds) ||
        assessed.evidenceIds.length !== 1 || assessed.evidenceIds[0] !== evidence.id)
      throw new Error("CLAIM_UNSUPPORTED");
    const goal = await callOpenAI("editorial_goal_assessment",
      "Return JSON {status:'satisfied'|'blocked',reason:string}. Is the revised paragraph substantively more grounded without overstatement? Do not presume success.",
      { before: script[1].text, after: revised.bodyText, passage: verified });
    if (goal.status !== "satisfied") throw new Error("EDITORIAL_GOAL_UNSATISFIED");
    console.log(JSON.stringify(report("REVIEW_REQUIRED", {
      providerSmokeTest: "PASS", actualElapsedMs: Math.round(performance.now() - started),
      sourceDocumentSha256: sha256(raw), verifiedPassageSha256: sha256(verified),
      passageStartOffset: extracted.indexOf(verified),
      preview: script.map((section) => section.id === "body-1" ? { ...section, text: revised.bodyText } : section),
      limitation: "Real provider smoke, not canonical whole-script refinement acceptance.",
    }), null, 2));
  } catch (error) {
    console.log(JSON.stringify(report("BLOCKED", {
      actualElapsedMs: Math.round(performance.now() - started),
      reason: error instanceof Error ? error.message : "UNKNOWN",
    }), null, 2));
    process.exitCode = 1;
  }
} else {
  console.log(JSON.stringify(report("REVIEW_REQUIRED", {
    reason: "DRY_RUN_ONLY",
    instructions: "Requires local --execute plus STAGE4B2_EXECUTION_CONSENT=confirmed-5usd-arxiv2304; never executes in CI.",
  }), null, 2));
}
