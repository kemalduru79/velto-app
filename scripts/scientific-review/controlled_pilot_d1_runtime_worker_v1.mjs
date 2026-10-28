// Stage 5E1G-C2B-B3-D1 container worker. Synthetic/offline use only.
import { createHash, randomBytes } from "node:crypto";
import { chmod, readFile, rm, writeFile } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import https from "node:https";
import net from "node:net";
import path from "node:path";

const ROLE = process.argv[2];
const sha256 = value => createHash("sha256").update(value).digest("hex");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const safeError = error => error instanceof Error ? error.message.replace(/sk-synthetic-b3-[A-Za-z0-9_-]+/g, "[REDACTED]") : "UNKNOWN";
const readJson = async file => JSON.parse(await readFile(file, "utf8"));
const writePrivate = async (file, value) => {
  await writeFile(file, value, { mode: 0o600, flag: "wx" });
  await chmod(file, 0o600);
};
const connectLine = (socketPath, value, timeoutMs = 3_000) => new Promise((resolve, reject) => {
  const socket = net.createConnection({ path: socketPath });
  let bytes = "";
  const timer = setTimeout(() => socket.destroy(new Error("IPC_TIMEOUT")), timeoutMs);
  socket.on("connect", () => socket.write(`${JSON.stringify(value)}\n`));
  socket.on("data", chunk => {
    bytes += chunk.toString("utf8");
    const newline = bytes.indexOf("\n");
    if (newline >= 0) { clearTimeout(timer); socket.end(); resolve(JSON.parse(bytes.slice(0, newline))); }
  });
  socket.on("error", error => { clearTimeout(timer); reject(error); });
});
const deniedTcp = (host, port, timeoutMs = 700) => new Promise(resolve => {
  const socket = net.createConnection({ host, port });
  const finish = outcome => { socket.destroy(); resolve(outcome); };
  socket.setTimeout(timeoutMs, () => finish("DENIED_TIMEOUT"));
  socket.once("connect", () => finish("UNEXPECTED_CONNECTED"));
  socket.once("error", error => finish(`DENIED_${error.code ?? "ERROR"}`));
});

async function provider() {
  const plan = await readJson("/app/plan.json");
  const key = await readFile("/tls/key.pem");
  const cert = await readFile("/tls/cert.pem");
  let next = 0;
  const server = https.createServer({ key, cert }, (request, response) => {
    let body = "";
    request.on("data", chunk => {
      body += chunk.toString("utf8");
      if (Buffer.byteLength(body, "utf8") > 250_000) request.destroy();
    });
    request.on("end", () => {
      const expected = plan.approved[next];
      const stage = next < 4 ? "count" : "generation";
      const expectedPath = stage === "count" ? "/v1/responses/input_tokens" : "/v1/responses";
      const authorized = /^Bearer sk-synthetic-b3-[A-Za-z0-9_-]{24,160}$/.test(request.headers.authorization ?? "");
      if (!expected || request.method !== "POST" || request.url !== expectedPath ||
          request.headers.host !== "b3-mock-provider.invalid" || request.headers["x-client-request-id"] !== expected.clientRequestId ||
          sha256(body) !== expected.bodySha256 || !authorized) {
        response.writeHead(403, { "content-type": "application/json", connection: "close" });
        response.end(JSON.stringify({ error: "SYNTHETIC_REQUEST_REJECTED" })); return;
      }
      next += 1;
      const responseBody = JSON.stringify(stage === "count" ? {
        object: "response.input_tokens", input_tokens: 4_000 + expected.ordinal,
        request_id: `synthetic-count-${expected.ordinal}`,
      } : {
        id: `synthetic-generation-${expected.ordinal}`, object: "response", status: "completed",
        model: "gpt-5.5-2026-04-23", output: [{ type: "message", role: "assistant",
          content: [{ type: "output_text", text: "Synthetic review only; no scientific authority." }] }],
        usage: { input_tokens: 4_000 + expected.ordinal, output_tokens: 700, total_tokens: 4_700 + expected.ordinal },
        scientific_authority: false, human_approval: false,
      });
      response.writeHead(200, { "content-type": "application/json", "content-length": String(Buffer.byteLength(responseBody)), connection: "close" });
      response.end(responseBody);
    });
  });
  server.on("tlsClientError", () => undefined);
  server.listen(8443, "0.0.0.0", () => console.log("D1_PROVIDER_READY"));
}

async function gateway() {
  const token = randomBytes(32).toString("hex");
  await writePrivate("/gateway-auth/gateway.token", token);
  await chmod("/gateway-auth/gateway.token", 0o640);
  const socketPath = "/gateway-ipc/gateway.sock";
  await rm(socketPath, { force: true });
  const externalProbe = await deniedTcp("1.1.1.1", 443);
  const hostProbe = await deniedTcp("host.docker.internal", 80);
  if (externalProbe === "UNEXPECTED_CONNECTED" || hostProbe === "UNEXPECTED_CONNECTED") {
    throw new Error("D1_GATEWAY_INTERNAL_NETWORK_ESCAPE_DETECTED");
  }
  const resolved = await lookup("mock-provider", { all: true, verbatim: true });
  const providerAddresses = [...new Set(resolved
    .filter(entry => entry.family === 4 && /^(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)/.test(entry.address))
    .map(entry => entry.address))];
  if (providerAddresses.length !== 1 || resolved.length !== 1) {
    throw new Error("D1_GATEWAY_PROVIDER_DNS_IDENTITY_AMBIGUOUS");
  }
  const pinnedProviderAddress = providerAddresses[0];
  const server = net.createServer(client => {
    let prefix = "";
    const authenticate = chunk => {
      prefix += chunk.toString("utf8");
      if (prefix.length > 96 || !prefix.includes("\n")) {
        if (prefix.length > 96) client.end("REJECT\n");
        return;
      }
      client.off("data", authenticate);
      if (prefix !== `VELTO-D1 ${token}\n`) { client.end("REJECT\n"); return; }
      // Resolve exactly once before accepting clients. Subsequent Docker DNS alias
      // changes cannot redirect an admitted execution to a different container.
      const upstream = net.createConnection({ host: pinnedProviderAddress, port: 8443 });
      upstream.once("connect", () => { client.write("OK\n"); client.pipe(upstream).pipe(client); });
      upstream.once("error", () => client.destroy());
      client.once("error", () => upstream.destroy());
    };
    client.on("data", authenticate);
  });
  server.listen(socketPath, async () => {
    await chmod(socketPath, 0o660);
    console.log(`D1_GATEWAY_READY external=${externalProbe} host=${hostProbe} providerIpPinned=true`);
  });
}

async function broker() {
  const { createB3BrokerGatewayTunnelTransport, inspectB3SyntheticCredentialLease,
    issueB3SyntheticCredentialLease } = await import("/app/lifecycle.mjs");
  const plan = await readJson("/app/plan.json");
  let gatewayToken;
  for (let attempt = 0; attempt < 100 && !gatewayToken; attempt += 1) {
    try { gatewayToken = (await readFile("/gateway-auth/gateway.token", "utf8")).trim(); }
    catch { await delay(50); }
  }
  if (!gatewayToken) throw new Error("D1_GATEWAY_TOKEN_UNAVAILABLE");
  const syntheticCredential = `sk-synthetic-b3-${randomBytes(32).toString("base64url")}`;
  const issuedAtMs = plan.issuedAtMs;
  const lease = await issueB3SyntheticCredentialLease({
    rootDirectory: "/state", plan, syntheticCredential,
    issuedAtMs, expiresAtMs: plan.expiresAtMs,
  });
  const transport = createB3BrokerGatewayTunnelTransport({
    socketPath: "/gateway-ipc/gateway.sock", ipcToken: gatewayToken,
    syntheticCaPem: await readFile("/tls/ca.pem", "utf8"),
  });
  const runnerToken = randomBytes(32).toString("hex");
  await writePrivate("/runner-auth/runner.token", runnerToken);
  await chmod("/runner-auth/runner.token", 0o640);
  const socketPath = "/runner-ipc/broker.sock";
  await rm(socketPath, { force: true });
  const server = net.createServer(client => {
    let line = "";
    client.on("data", chunk => {
      line += chunk.toString("utf8");
      if (line.length > 400_000) client.destroy();
      if (!line.includes("\n")) return;
      client.removeAllListeners("data");
      void (async () => {
        try {
          const message = JSON.parse(line.slice(0, line.indexOf("\n")));
          if (message.token !== runnerToken) { client.end(`${JSON.stringify({ ok: false, code: "UNAUTHORIZED_SOCKET_CLIENT" })}\n`); return; }
          if (message.action === "status") {
            const descriptor = lease.descriptor();
            const inspection = await inspectB3SyntheticCredentialLease(path.join("/state", `lease-${descriptor.leaseId}`));
            client.end(`${JSON.stringify({ ok: true, status: lease.status(), inspection,
              transport: transport.observations(), syntheticCredentialStatus: inspection.secretPresent ? "ACTIVE" : "DESTROYED" })}\n`); return;
          }
          if (message.action === "revoke") {
            client.end(`${JSON.stringify({ ok: true, revocation: await lease.revokeLocal() })}\n`); return;
          }
          if (message.action !== "dispatch") throw new Error("D1_BROKER_ACTION_INVALID");
          const entry = message.entry;
          const receipt = await lease.dispatch({ ...entry, nowMs: issuedAtMs + 1_000, transport });
          client.end(`${JSON.stringify({ ok: true, receipt, result: message.stage === "count" ? "COUNT_COMPLETED" : "GENERATION_COMPLETED" })}\n`);
        } catch (error) {
          client.end(`${JSON.stringify({ ok: false, code: safeError(error) })}\n`);
        }
      })();
    });
  });
  server.listen(socketPath, async () => {
    await chmod(socketPath, 0o660);
    console.log("D1_BROKER_READY");
  });
}

async function runner() {
  const fixture = await readJson("/app/requests.json");
  const externalTcp = await deniedTcp("1.1.1.1", 443);
  const directProvider = await deniedTcp("mock-provider", 8443);
  let rootReadOnly = false;
  try { await writeFile("/forbidden-root-write", "no"); } catch (error) { rootReadOnly = ["EROFS", "EACCES"].includes(error.code); }
  await writeFile("/tmp/d1-writable", "ok", { flag: "wx" });
  const runnerToken = (await readFile("/runner-auth/runner.token", "utf8")).trim();
  let credentialAbsent = false;
  try { await readFile("/broker-secret/synthetic-credential.bin"); } catch (error) { credentialAbsent = error.code === "ENOENT"; }
  const unauthorized = await connectLine("/runner-ipc/broker.sock", { token: "0".repeat(64), action: "status" });
  const operations = [];
  for (const entry of fixture.entries) {
    const result = await connectLine("/runner-ipc/broker.sock", { token: runnerToken, action: "dispatch", entry });
    if (!result.ok) throw new Error(`D1_DISPATCH_FAILED ${result.code}`);
    operations.push({ stage: entry.stage, ordinal: entry.ordinal,
      clientRequestId: entry.request.headers["x-client-request-id"], status: result.result });
  }
  const status = await connectLine("/runner-ipc/broker.sock", { token: runnerToken, action: "status" });
  const revoked = await connectLine("/runner-ipc/broker.sock", { token: runnerToken, action: "revoke" });
  const replay = await connectLine("/runner-ipc/broker.sock", { token: runnerToken, action: "dispatch", entry: fixture.entries[0] });
  const report = {
    version: "stage-5e1g-c2b-b3-d1-integrated-runtime-v1",
    disposition: "OFFLINE_SYNTHETIC_COMPLETED_NO_SCIENTIFIC_AUTHORITY",
    mockOnly: true, liveNoGo: true, realProviderRequests: 0,
    requestsAuthorized: status.status.completedOrConsumed,
    requestsDispatched: operations.length, requestsCompleted: operations.length,
    requestsRejected: 2, attemptConsumption: status.inspection.admittedAttempts,
    operations, fourReviewerRoles: fixture.roles,
    syntheticCredentialStatus: revoked.revocation.localLeaseRevoked ? "LOCALLY_REVOKED_DESTROYED" : "UNKNOWN",
    modeledBillingUsd: 0.55, maximumModeledGenerationReservationUsd: 0.75,
    actualProviderBillingUsd: 0, providerBillingAuthority: false,
    scientificAuthority: false, humanApproval: false,
    isolation: {
      runnerExternalTcp: externalTcp, runnerDirectProvider: directProvider,
      runnerCredentialAbsent: credentialAbsent, rootFilesystemReadOnly: rootReadOnly,
      writableTmpfsObserved: true, unauthorizedSocketClient: unauthorized.code,
      replayAfterRevocation: replay.code,
    },
  };
  if (report.requestsCompleted !== 8 || report.attemptConsumption !== 8 ||
      externalTcp === "UNEXPECTED_CONNECTED" || directProvider === "UNEXPECTED_CONNECTED" ||
      !credentialAbsent || !rootReadOnly || unauthorized.code !== "UNAUTHORIZED_SOCKET_CLIENT" || replay.ok !== false) {
    throw new Error("D1_RUNNER_ACCEPTANCE_FAILED");
  }
  console.log(`D1_REPORT=${JSON.stringify(report)}`);
}

try {
  if (ROLE === "provider") await provider();
  else if (ROLE === "gateway") await gateway();
  else if (ROLE === "broker") await broker();
  else if (ROLE === "runner") await runner();
  else throw new Error("D1_ROLE_INVALID");
} catch (error) {
  console.error(`D1_${String(ROLE).toUpperCase()}_FAILURE=${safeError(error)}`);
  process.exitCode = 1;
}
