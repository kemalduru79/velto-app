import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import { EventEmitter } from "node:events";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { PilotOneUseLedger, validatePilotBody, assertPilotAuthorization, responsesRequestOnce, executeAuthorizedPilotRequest } from "./quality/issue50-pilot-transport.mjs";
const hash = (b) => createHash("sha256").update(b).digest("hex");
let assertions = 0; const check = (fn) => { fn(); assertions++; };
const body = { model: "gpt-6.1-sol", service_tier: "default", store: false, background: false, tools: [], max_output_tokens: 25000, reasoning: { effort: "medium" }, input: [{ role: "system", content: "Test" }, { role: "user", content: "Public test" }], text: { format: { type: "json_schema", strict: true, name: "test", schema: { type: "object" } } } };
const encoded = Buffer.from(JSON.stringify(body));
const tokens = { bodySha256: hash(encoded), inputTokens: 100, method: "reviewed_model_compatible_tokenizer" };
check(() => assert.deepEqual(validatePilotBody(body, tokens), encoded));
for (const changes of [{ model: "other" }, { service_tier: "priority" }, { tools: [{ type: "web_search" }] }, { store: true }, { background: true }, { max_output_tokens: 25001 }, { previous_response_id: "unexpected" }]) check(() => assert.throws(() => validatePilotBody({ ...body, ...changes }, tokens)));
for (const changes of [{ inputTokens: 20001 }, { inputTokens: 0 }, { inputTokens: 1.5 }, { bodySha256: "0".repeat(64) }, { method: "estimated" }]) check(() => assert.throws(() => validatePilotBody(body, { ...tokens, ...changes })));
check(() => assert.throws(() => assertPilotAuthorization(Buffer.from("APPROVED")), /AUTHORIZATION_REQUIRED/));
await assert.rejects(executeAuthorizedPilotRequest({ authorizationBytes: Buffer.from("APPROVED"), body, tokenReceipt: tokens }), /AUTHORIZATION_REQUIRED/); assertions++;
const scratch = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "issue50-live-transport-test-")); fs.chmodSync(scratch, 0o700);
const receipt = { id: "resp-test", model: "gpt-6.1-sol", service_tier: "default", status: "completed", usage: { input_tokens: 80, output_tokens: 200 }, output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: '{"text":"closed fixture"}' }] }] };
function simulated(value = receipt, status = 200, event = null) {
  let calls = 0;
  const request = (options, callback) => {
    calls++; assert.equal(options.hostname, "api.openai.com"); assert.equal(options.path, "/v1/responses"); assert.equal(options.rejectUnauthorized, true); assert.equal(options.agent, false);
    const req = new EventEmitter(); req.destroy = () => {}; req.end = () => queueMicrotask(() => {
      if (event === "timeout") return;
      if (event === "error") { req.emit("error", Error("private-secret")); return; }
      const res = new EventEmitter(); res.statusCode = status; res.headers = {}; res.destroy = () => {}; callback(res);
      if (event === "abort") { res.emit("aborted"); return; }
      res.emit("data", Buffer.from(JSON.stringify(value))); res.emit("end");
    }); return req;
  }; return { request, calls: () => calls };
}
try {
  const dir = path.join(scratch, "ledger"); fs.mkdirSync(dir, { mode: 0o700 }); const ledger = new PilotOneUseLedger(dir, "1".repeat(64), 1000);
  check(() => assert.throws(() => new PilotOneUseLedger(dir, "1".repeat(64)), /EEXIST/));
  for (let i = 1; i <= 5; i++) { check(() => assert.equal(ledger.consume(hash(String(i)), 1001), i)); check(() => assert.throws(() => ledger.consume(hash("parallel"), 1001))); ledger.complete(i, { status: "closed-test" }); }
  check(() => assert.throws(() => ledger.consume(hash("six"), 1001), /EXHAUSTED/));
  check(() => assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "RUN_CONSUMED.json"))).reservedMicrousd, 1650000));
  ledger.stop();
  check(() => assert.throws(() => ledger.consume(hash("retry"), 1001)));
  const expiredDir = path.join(scratch, "expired"); fs.mkdirSync(expiredDir, { mode: 0o700 }); const expired = new PilotOneUseLedger(expiredDir, "2".repeat(64), 0);
  check(() => assert.throws(() => expired.consume(hash("late"), 900000)));
  fs.symlinkSync(dir, path.join(scratch, "link")); check(() => assert.throws(() => new PilotOneUseLedger(path.join(scratch, "link"), "3".repeat(64)), /SYMLINK/));
  const ok = simulated(); check(() => assert.equal(ok.calls(), 0)); const accepted = await responsesRequestOnce(encoded, "test-only", ok); check(() => assert.equal(accepted.output.text, "closed fixture")); check(() => assert.equal(ok.calls(), 1));
  for (const [value, status, event] of [[receipt, 302], [receipt, 429], [receipt, 500], [{ ...receipt, status: "incomplete" }, 200], [{ ...receipt, model: "different" }, 200], [{ ...receipt, usage: null }, 200], [{ ...receipt, usage: { input_tokens: 20001, output_tokens: 10 } }, 200], [{ ...receipt, usage: { input_tokens: 10, output_tokens: 25001 } }, 200], [{ ...receipt, output: [{ type: "function_call" }] }, 200], [receipt, 200, "abort"], [receipt, 200, "error"], [receipt, 200, "timeout"]]) {
    const stub = simulated(value, status, event); await assert.rejects(responsesRequestOnce(encoded, "test-only", { ...stub, timeoutMs: 10 })); assertions++; check(() => assert.equal(stub.calls(), 1));
  }
  const oversized = simulated(); await assert.rejects(responsesRequestOnce(encoded, "test-only", { ...oversized, maxBytes: 5 })); assertions++;
  // Real TLS socket test, local server only. Certificate/key are throwaway test
  // identities, never provider credentials and never committed.
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost", "-keyout", path.join(scratch, "key.pem"), "-out", path.join(scratch, "cert.pem")], { stdio: "ignore" });
  const cert = fs.readFileSync(path.join(scratch, "cert.pem")); let localRequests = 0;
  const server = https.createServer({ key: fs.readFileSync(path.join(scratch, "key.pem")), cert }, (req, res) => { localRequests++; req.resume(); req.on("end", () => { res.writeHead(200, { "content-type": "application/json", "x-request-id": "local-tls-test" }); res.end(JSON.stringify(receipt)); }); });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  try {
    const result = await responsesRequestOnce(encoded, "test-only", { request: (options, cb) => { assert.equal(options.hostname, "api.openai.com"); return https.request({ ...options, hostname: "127.0.0.1", port: server.address().port, servername: "localhost", ca: cert }, cb); } });
    check(() => assert.equal(result.requestId, "local-tls-test")); check(() => assert.equal(localRequests, 1));
    await assert.rejects(responsesRequestOnce(encoded, "test-only", { request: (options, cb) => https.request({ ...options, hostname: "127.0.0.1", port: server.address().port, servername: "localhost" }, cb) })); assertions++;
    check(() => assert.equal(localRequests, 1));
  } finally { await new Promise((resolve) => server.close(resolve)); }
  console.log(JSON.stringify({ status: "PASS", assertions, realLocalTls: "TRUSTED_CERT_PASS_UNTRUSTED_CERT_DENIED", providerCalls: 0, liveAuthorization: "DENIED", ledgerDurability: "SINGLE_HOST_FSYNC_NOT_INDEPENDENT_HOST_LOSS_PROOF", tokenAuthority: "NOT_QUALIFIED_BY_SYNTHETIC_RECEIPT_TESTS" }));
} finally { fs.rmSync(scratch, { recursive: true, force: true }); }
