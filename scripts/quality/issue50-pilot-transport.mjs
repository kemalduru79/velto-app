// Branch-only pilot candidate. No application imports, credential reads or live CLI.
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
const hash = (b) => createHash("sha256").update(b).digest("hex");
export const ACCEPTED_LIVE_AUTHORIZATION = null; // owner approval NOT recorded
export function assertPilotAuthorization(receiptBytes) {
  if (ACCEPTED_LIVE_AUTHORIZATION === null || hash(receiptBytes) !== ACCEPTED_LIVE_AUTHORIZATION) throw Error("PILOT_OWNER_AUTHORIZATION_REQUIRED");
}
export function validatePilotBody(body, tokenReceipt) {
  if (Object.keys(body).sort().join(",") !== "background,input,max_output_tokens,model,reasoning,service_tier,store,text,tools") throw Error("PILOT_EXTRA_FIELD_DENIED");
  if (body.model !== "gpt-6.1-sol" || body.service_tier !== "default" || body.store !== false || body.background !== false || body.tools?.length !== 0 || body.max_output_tokens !== 25000 || body.reasoning?.effort !== "medium" || body.text?.format?.type !== "json_schema" || body.text.format.strict !== true || !Array.isArray(body.input) || body.input.length !== 2 || body.input.some((m, i) => m.role !== ["system", "user"][i] || typeof m.content !== "string")) throw Error("PILOT_BODY_DENIED");
  const encoded = Buffer.from(JSON.stringify(body));
  if (encoded.length > 150000 || !Number.isSafeInteger(tokenReceipt?.inputTokens) || tokenReceipt.inputTokens <= 0 || tokenReceipt.inputTokens > 20000 || tokenReceipt.bodySha256 !== hash(encoded) || !["provider_exact_count", "reviewed_model_compatible_tokenizer"].includes(tokenReceipt.method)) throw Error("PILOT_TOKEN_ADMISSION_REQUIRED");
  // Receipt authenticity must be independently checked before live authorization;
  // a caller-supplied number is not a qualified token counter.
  return encoded;
}
function syncDirectory(directory) { const fd = fs.openSync(directory, fs.constants.O_RDONLY); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
function exclusive(directory, name, object) {
  const fd = fs.openSync(path.join(directory, name), fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(object) + "\n"); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  syncDirectory(directory);
}
export class PilotOneUseLedger {
  constructor(directory, runFingerprint, now = Date.now()) {
    if (!/^[a-f0-9]{64}$/.test(runFingerprint)) throw Error("RUN_IDENTITY_REQUIRED");
    const absolute = path.resolve(directory); let current = path.parse(absolute).root;
    for (const component of absolute.slice(current.length).split(path.sep)) { current = path.join(current, component); if (fs.lstatSync(current).isSymbolicLink()) throw Error("LEDGER_SYMLINK_DENIED"); }
    const st = fs.lstatSync(absolute);
    if (!st.isDirectory() || (st.mode & 0o077) !== 0 || st.uid !== process.getuid()) throw Error("PRIVATE_OWNED_LEDGER_REQUIRED");
    this.directory = fs.realpathSync(absolute); this.ordinal = 0; this.started = now; this.stopped = false; this.inFlight = false;
    // Burn the entire logical run before dispatch; no restart, cleanup or replay
    // path. Unknown outcome stays spent. Single-host durability only, explicitly.
    exclusive(this.directory, "RUN_CONSUMED.json", { runFingerprint, reservedMicrousd: 1650000, maxAttempts: 5, started: now });
  }
  consume(bodySha256, now = Date.now()) {
    if (this.stopped || this.inFlight || now < this.started || now - this.started >= 900000 || this.ordinal >= 5 || !/^[a-f0-9]{64}$/.test(bodySha256)) throw Error("RUN_STOPPED_OR_EXHAUSTED");
    const ordinal = this.ordinal + 1;
    exclusive(this.directory, `attempt-${ordinal}.json`, { ordinal, bodySha256, reservedMicrousd: 330000, state: "CONSUMED_BEFORE_DISPATCH" });
    this.ordinal = ordinal; this.inFlight = true; return ordinal;
  }
  complete(ordinal, receipt) {
    if (!this.inFlight || ordinal !== this.ordinal || !Number.isSafeInteger(ordinal) || ordinal < 1) throw Error("OUTCOME_ORDINAL_INVALID");
    exclusive(this.directory, `outcome-${ordinal}.json`, receipt); this.inFlight = false;
  }
  stop() { this.stopped = true; }
}
// No SDK, redirects, proxy env, cookies, retries, Supabase or economics calls.
// Injection seam is for closed transport tests, not exposed by a live entrypoint.
export function responsesRequestOnce(encodedBody, apiKey, { request = https.request, timeoutMs = 300000, maxBytes = 2 * 1024 * 1024 } = {}) {
  if (typeof apiKey !== "string" || !apiKey || /[\r\n]/.test(apiKey) || timeoutMs <= 0 || timeoutMs > 300000 || maxBytes <= 0 || maxBytes > 2 * 1024 * 1024) throw Error("TRANSPORT_PREFLIGHT_REQUIRED");
  return new Promise((resolve, reject) => {
    let settled = false; let req; const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); if (error) reject(Error(error)); else resolve(value); };
    const timer = setTimeout(() => { finish("PILOT_TIMEOUT_AMBIGUOUS_NO_REPLAY"); req?.destroy(); }, timeoutMs);
    try {
      req = request({ protocol: "https:", hostname: "api.openai.com", servername: "api.openai.com", port: 443, path: "/v1/responses", method: "POST", minVersion: "TLSv1.2", rejectUnauthorized: true, agent: false, headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Content-Length": encodedBody.length } }, (res) => {
        if (res.statusCode !== 200) { finish("PILOT_HTTP_FAILURE_NO_RETRY"); res.destroy(); return; }
        const chunks = []; let size = 0;
        res.on("data", (chunk) => { size += chunk.length; if (size > maxBytes) { finish("PILOT_RESPONSE_TOO_LARGE"); res.destroy(); } else chunks.push(chunk); });
        res.on("error", () => finish("PILOT_RESPONSE_AMBIGUOUS_NO_REPLAY"));
        res.on("aborted", () => finish("PILOT_RESPONSE_AMBIGUOUS_NO_REPLAY"));
        res.on("end", () => { try { resolveValidated(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { finish("PILOT_INVALID_RESPONSE_NO_RETRY"); } });
        function resolveValidated(value) {
          if (value.status !== "completed" || value.model !== "gpt-6.1-sol" || value.service_tier !== "default" || typeof value.id !== "string" || !value.id || !Number.isSafeInteger(value.usage?.input_tokens) || value.usage.input_tokens < 0 || value.usage.input_tokens > 20000 || !Number.isSafeInteger(value.usage?.output_tokens) || value.usage.output_tokens < 0 || value.usage.output_tokens > 25000 || value.error || value.incomplete_details) throw Error("DENIED");
          if (!Array.isArray(value.output) || value.output.some((o) => o.type !== "message" && o.type !== "reasoning") || value.output.some((o) => o.type === "message" && (o.role !== "assistant" || o.content?.some((c) => c.type !== "output_text")))) throw Error("DENIED");
          const texts = value.output.filter((o) => o.type === "message").flatMap((o) => o.content || []).map((c) => c.text);
          if (texts.length !== 1 || typeof texts[0] !== "string") throw Error("DENIED");
          finish(null, { output: JSON.parse(texts[0]), usage: value.usage, responseId: value.id, requestId: res.headers?.["x-request-id"] || null });
        }
      });
      req.on("error", () => finish("PILOT_TRANSPORT_AMBIGUOUS_NO_REPLAY")); req.end(encodedBody);
    } catch { finish("PILOT_TRANSPORT_AMBIGUOUS_NO_REPLAY"); }
  });
}
export async function executeAuthorizedPilotRequest({ authorizationBytes, body, tokenReceipt, ledger, apiKey }) {
  assertPilotAuthorization(authorizationBytes); // always denies in this candidate
  const encoded = validatePilotBody(body, tokenReceipt);
  const ordinal = ledger.consume(hash(encoded));
  try { const receipt = await responsesRequestOnce(encoded, apiKey); if (receipt.usage.input_tokens > tokenReceipt.inputTokens) throw Error("TOKEN_BOUND_EXCEEDED"); ledger.complete(ordinal, receipt); return receipt.output; }
  catch { ledger.stop(); throw Error("PILOT_STOP_NO_REPLAY"); }
}
