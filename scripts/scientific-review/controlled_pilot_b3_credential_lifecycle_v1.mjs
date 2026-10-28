// Stage 5E1G-C2B-B3: broker-owned SYNTHETIC credential lifecycle.
// No live credential format, public egress, environment activation, or provider authority.
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { chmod, lstat, mkdir, open, readFile, realpath, rm, stat } from "node:fs/promises";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";
import { validateB3OfflineBrokerRequest } from "./controlled_pilot_b3_offline_broker_v1.mjs";
import { B3_TLS_MOCK_HOST } from "./controlled_pilot_b3_loopback_tls_v1.mjs";

export const B3_CREDENTIAL_LIFECYCLE_VERSION = "stage-5e1g-c2b-b3-credential-lifecycle-v1";
export const B3_CREDENTIAL_LIVE_EGRESS_ENABLED = false;
const SYNTHETIC_CREDENTIAL = /^sk-synthetic-b3-[A-Za-z0-9_-]{24,160}$/;
const PATHS = Object.freeze({ count: "/v1/responses/input_tokens", generation: "/v1/responses" });
const MAX_REPLY_BYTES = 1_000_000;
const APPROVED_TRANSPORTS = new WeakSet();

function deny(code) { throw new Error(`STAGE_5E1G_B3_CREDENTIAL_${code}`); }
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function approvedDarwinAlias(parent, resolved) {
  return process.platform === "darwin" &&
    (parent === "/tmp" || parent.startsWith("/tmp/") || parent === "/var" || parent.startsWith("/var/")) &&
    resolved === `/private${parent}`;
}
async function assertPrivateDirectory(directory) {
  const absolute = path.resolve(directory);
  const resolved = await realpath(absolute);
  const metadata = await lstat(absolute);
  if ((!approvedDarwinAlias(absolute, resolved) && resolved !== absolute) || metadata.isSymbolicLink() ||
      !metadata.isDirectory() || (metadata.mode & 0o077) !== 0) deny("PRIVATE_DIRECTORY_INVALID");
  return resolved;
}
async function durableExclusive(directory, name, value) {
  const destination = path.join(directory, name);
  const handle = await open(destination,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(value); await handle.sync(); } finally { await handle.close(); }
  const parent = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY);
  try { await parent.sync(); } finally { await parent.close(); }
  return destination;
}
async function readSyntheticCredential(secretPath, expectedIdentity) {
  const metadata = await lstat(secretPath);
  if (metadata.isSymbolicLink() || !metadata.isFile() || (metadata.mode & 0o177) !== 0) deny("SECRET_FILE_INVALID");
  if (metadata.dev !== expectedIdentity.dev || metadata.ino !== expectedIdentity.ino) deny("SECRET_FILE_IDENTITY_CHANGED");
  const handle = await open(secretPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const bytes = await handle.readFile();
    const text = bytes.toString("utf8");
    if (!SYNTHETIC_CREDENTIAL.test(text)) { bytes.fill(0); deny("SYNTHETIC_CREDENTIAL_INVALID"); }
    return bytes;
  } finally { await handle.close(); }
}

class B3BrokerOnlyLoopbackTransport {
  #port; #ca; #observations = [];
  constructor({ port, syntheticCaPem }) {
    if (!Number.isInteger(port) || port < 1 || port > 65535 ||
        typeof syntheticCaPem !== "string" || syntheticCaPem.length > 20_000 ||
        !syntheticCaPem.includes("-----BEGIN CERTIFICATE-----")) deny("TRANSPORT_CONFIG_INVALID");
    this.#port = port;
    this.#ca = syntheticCaPem;
  }
  observations() { return Object.freeze(this.#observations.map(item => Object.freeze({ ...item }))); }
  async dispatchAuthorized(request, stage, ordinal, credentialBytes) {
    validateB3OfflineBrokerRequest(request.plan, request.httpRequest, stage, ordinal);
    const credential = credentialBytes.toString("utf8");
    if (!SYNTHETIC_CREDENTIAL.test(credential)) deny("TRANSPORT_CREDENTIAL_INVALID");
    const body = request.httpRequest.body;
    const clientRequestId = request.httpRequest.headers["x-client-request-id"];
    const result = await new Promise((resolve, reject) => {
      const client = https.request({
        protocol: "https:", hostname: "127.0.0.1", port: this.#port,
        servername: B3_TLS_MOCK_HOST, method: "POST", path: PATHS[stage],
        ca: this.#ca, rejectUnauthorized: true, agent: false, timeout: 2_000,
        headers: {
          "content-type": "application/json",
          "content-length": String(Buffer.byteLength(body, "utf8")),
          "x-client-request-id": clientRequestId,
          authorization: `Bearer ${credential}`,
        },
      }, response => {
        if (response.statusCode !== 200 || response.headers.location || response.headers["content-encoding"] ||
            response.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") {
          response.destroy(); reject(new Error("STAGE_5E1G_B3_CREDENTIAL_HTTP_RESPONSE_REJECTED")); return;
        }
        let size = 0; const chunks = [];
        response.on("data", chunk => {
          size += chunk.length;
          if (size > MAX_REPLY_BYTES) response.destroy(new Error("STAGE_5E1G_B3_CREDENTIAL_RESPONSE_TOO_LARGE"));
          else chunks.push(chunk);
        });
        response.on("end", () => {
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) deny("RESPONSE_INVALID");
            resolve(parsed);
          } catch { reject(new Error("STAGE_5E1G_B3_CREDENTIAL_RESPONSE_INVALID")); }
        });
        response.on("error", reject);
      });
      client.on("timeout", () => client.destroy(new Error("STAGE_5E1G_B3_CREDENTIAL_TIMEOUT_AMBIGUOUS")));
      client.on("error", reject);
      client.end(body);
    });
    this.#observations.push({ stage, ordinal, clientRequestId, credentialObservedByBrokerOnly: true });
    return result;
  }
}
Object.freeze(B3BrokerOnlyLoopbackTransport.prototype);

class B3BrokerGatewayTunnelTransport {
  #socketPath; #ipcToken; #ca; #observations = [];
  constructor({ socketPath, ipcToken, syntheticCaPem }) {
    if (typeof socketPath !== "string" || !path.isAbsolute(socketPath) || socketPath.length > 180 ||
        typeof ipcToken !== "string" || !/^[a-f0-9]{64}$/.test(ipcToken) ||
        typeof syntheticCaPem !== "string" || syntheticCaPem.length > 20_000 ||
        !syntheticCaPem.includes("-----BEGIN CERTIFICATE-----")) deny("GATEWAY_TRANSPORT_CONFIG_INVALID");
    this.#socketPath = socketPath;
    this.#ipcToken = ipcToken;
    this.#ca = syntheticCaPem;
  }
  observations() { return Object.freeze(this.#observations.map(item => Object.freeze({ ...item }))); }
  async dispatchAuthorized(request, stage, ordinal, credentialBytes) {
    validateB3OfflineBrokerRequest(request.plan, request.httpRequest, stage, ordinal);
    const credential = credentialBytes.toString("utf8");
    if (!SYNTHETIC_CREDENTIAL.test(credential)) deny("GATEWAY_TRANSPORT_CREDENTIAL_INVALID");
    const raw = await new Promise((resolve, reject) => {
      const socket = net.createConnection({ path: this.#socketPath });
      let prefix = Buffer.alloc(0);
      const fail = error => { socket.destroy(); reject(error); };
      socket.setTimeout(2_000, () => fail(new Error("STAGE_5E1G_B3_CREDENTIAL_GATEWAY_TIMEOUT_AMBIGUOUS")));
      socket.once("error", reject);
      socket.once("connect", () => socket.write(`VELTO-D1 ${this.#ipcToken}\n`));
      const authenticate = chunk => {
        prefix = Buffer.concat([prefix, chunk]);
        if (prefix.length > 16 || !prefix.includes(0x0a)) {
          if (prefix.length > 16) fail(new Error("STAGE_5E1G_B3_CREDENTIAL_GATEWAY_AUTH_REJECTED"));
          return;
        }
        socket.off("data", authenticate);
        if (prefix.toString("utf8") !== "OK\n") {
          fail(new Error("STAGE_5E1G_B3_CREDENTIAL_GATEWAY_AUTH_REJECTED")); return;
        }
        socket.setTimeout(0);
        const secure = tls.connect({
          socket, servername: B3_TLS_MOCK_HOST, ca: this.#ca,
          rejectUnauthorized: true, ALPNProtocols: ["http/1.1"],
        });
        const chunks = []; let size = 0;
        secure.setTimeout(2_000, () => secure.destroy(new Error("STAGE_5E1G_B3_CREDENTIAL_TLS_TIMEOUT_AMBIGUOUS")));
        secure.once("secureConnect", () => {
          const body = request.httpRequest.body;
          const headers = [
            `POST ${PATHS[stage]} HTTP/1.1`,
            `Host: ${B3_TLS_MOCK_HOST}`,
            "Content-Type: application/json",
            `Content-Length: ${Buffer.byteLength(body, "utf8")}`,
            `X-Client-Request-Id: ${request.httpRequest.headers["x-client-request-id"]}`,
            `Authorization: Bearer ${credential}`,
            "Connection: close", "", body,
          ].join("\r\n");
          // Content-Length terminates the HTTP request. Keep the TLS write side open
          // until the mock provider returns its Connection: close response; sending
          // close_notify here can race the server response through the raw tunnel.
          secure.write(headers);
        });
        secure.on("data", data => {
          size += data.length;
          if (size > MAX_REPLY_BYTES) secure.destroy(new Error("STAGE_5E1G_B3_CREDENTIAL_RESPONSE_TOO_LARGE"));
          else chunks.push(data);
        });
        secure.once("error", reject);
        secure.once("end", () => resolve(Buffer.concat(chunks)));
      };
      socket.on("data", authenticate);
    });
    const separator = raw.indexOf("\r\n\r\n");
    if (separator < 1) throw new Error(`STAGE_5E1G_B3_CREDENTIAL_GATEWAY_HTTP_RESPONSE_INVALID_${raw.length}_${raw.subarray(0, 24).toString("hex")}`);
    const header = raw.subarray(0, separator).toString("latin1");
    const body = raw.subarray(separator + 4).toString("utf8");
    if (!/^HTTP\/1\.1 200(?: |\r\n)/.test(header) || !/\r\ncontent-type:\s*application\/json(?:;[^\r\n]*)?/i.test(`\r\n${header}`) ||
        /\r\n(?:location|content-encoding):/i.test(`\r\n${header}`)) deny("GATEWAY_HTTP_RESPONSE_REJECTED");
    let result;
    try { result = JSON.parse(body); } catch { deny("GATEWAY_RESPONSE_INVALID"); }
    if (!result || typeof result !== "object" || Array.isArray(result)) deny("GATEWAY_RESPONSE_INVALID");
    this.#observations.push({ stage, ordinal, clientRequestId: request.httpRequest.headers["x-client-request-id"],
      credentialObservedByBrokerOnly: true, gatewayObservedOnlyTlsCiphertext: true });
    return result;
  }
}
Object.freeze(B3BrokerGatewayTunnelTransport.prototype);

export function createB3BrokerOnlyLoopbackTransport(configuration) {
  const transport = Object.freeze(new B3BrokerOnlyLoopbackTransport(configuration));
  APPROVED_TRANSPORTS.add(transport);
  return transport;
}

export function createB3BrokerGatewayTunnelTransport(configuration) {
  const transport = Object.freeze(new B3BrokerGatewayTunnelTransport(configuration));
  APPROVED_TRANSPORTS.add(transport);
  return transport;
}

export async function issueB3SyntheticCredentialLease({
  rootDirectory, plan, syntheticCredential, issuedAtMs, expiresAtMs,
}) {
  if (!plan || plan.liveForwardingEnabled !== false || plan.authority !== "SYNTHETIC_OFFLINE_POLICY_ONLY" ||
      typeof syntheticCredential !== "string" || !SYNTHETIC_CREDENTIAL.test(syntheticCredential) ||
      !Number.isSafeInteger(issuedAtMs) || !Number.isSafeInteger(expiresAtMs) || expiresAtMs <= issuedAtMs ||
      expiresAtMs - issuedAtMs > 15 * 60_000) deny("LEASE_INPUT_INVALID");
  const root = await assertPrivateDirectory(rootDirectory);
  const leaseId = sha256(stable({ version: B3_CREDENTIAL_LIFECYCLE_VERSION, executionId: plan.executionId, issuedAtMs, expiresAtMs }));
  const leaseDirectory = path.join(root, `lease-${leaseId}`);
  await mkdir(leaseDirectory, { mode: 0o700 });
  await chmod(leaseDirectory, 0o700);
  const attemptsDirectory = path.join(leaseDirectory, "attempts");
  await mkdir(attemptsDirectory, { mode: 0o700 });
  const secretPath = await durableExclusive(leaseDirectory, "synthetic-credential.bin", Buffer.from(syntheticCredential, "utf8"));
  const secretMetadata = await lstat(secretPath);
  const secretIdentity = Object.freeze({ dev: secretMetadata.dev, ino: secretMetadata.ino });
  const descriptor = Object.freeze({
    version: B3_CREDENTIAL_LIFECYCLE_VERSION,
    authority: "SYNTHETIC_BROKER_LOCAL_LEASE_ONLY",
    leaseId, executionId: plan.executionId, issuedAtMs, expiresAtMs,
    maximumRequests: 8, credentialMaterialExposed: false,
    localRevocationSupported: true, providerSideRevocationPerformed: false,
    liveEgressEnabled: false,
  });
  await durableExclusive(leaseDirectory, "lease.json", `${JSON.stringify(descriptor, null, 2)}\n`);
  let next = 0;
  let revoked = false;
  let terminal = false;
  let secretDestroyed = false;
  let queue = Promise.resolve();
  const destroyLocalCredential = async () => {
    if (secretDestroyed) return;
    await rm(secretPath, { force: true });
    const parent = await open(leaseDirectory, constants.O_RDONLY | constants.O_DIRECTORY);
    try { await parent.sync(); } finally { await parent.close(); }
    secretDestroyed = true;
  };

  const dispatch = input => {
    const operation = queue.then(async () => {
      if (revoked) deny("LEASE_REVOKED");
      if (terminal) deny("LEASE_TERMINAL");
      if (!Number.isSafeInteger(input?.nowMs) || input.nowMs < issuedAtMs || input.nowMs >= expiresAtMs) {
        terminal = true; await destroyLocalCredential(); deny("LEASE_EXPIRED");
      }
      if (!APPROVED_TRANSPORTS.has(input.transport)) deny("UNTRUSTED_TRANSPORT");
      const expectedStage = next < 4 ? "count" : "generation";
      const expectedOrdinal = (next % 4) + 1;
      if (input.stage !== expectedStage || input.ordinal !== expectedOrdinal) deny("REQUEST_ORDER_OR_REPLAY_INVALID");
      validateB3OfflineBrokerRequest(plan, input.request, input.stage, input.ordinal);
      const attempt = next + 1;
      next += 1;
      const attemptRecord = {
        version: B3_CREDENTIAL_LIFECYCLE_VERSION, leaseId, attempt,
        stage: input.stage, ordinal: input.ordinal,
        clientRequestId: input.request.headers["x-client-request-id"],
        requestBodySha256: input.request.bodySha256,
        status: "ADMITTED_DISPATCH_OUTCOME_UNKNOWN",
      };
      await durableExclusive(attemptsDirectory, `${String(attempt).padStart(2, "0")}-admitted.json`,
        `${JSON.stringify(attemptRecord, null, 2)}\n`);
      let credentialBytes;
      try {
        credentialBytes = await readSyntheticCredential(secretPath, secretIdentity);
        const response = await input.transport.dispatchAuthorized(
          { plan, httpRequest: input.request }, input.stage, input.ordinal, credentialBytes,
        );
        const receipt = {
          ...attemptRecord,
          status: "SYNTHETIC_LOOPBACK_COMPLETED",
          responseSha256: sha256(stable(response)),
          providerBillingAuthority: false,
          scientificAuthority: false,
        };
        await durableExclusive(attemptsDirectory, `${String(attempt).padStart(2, "0")}-receipt.json`,
          `${JSON.stringify(receipt, null, 2)}\n`);
        return Object.freeze({ ...receipt });
      } catch (error) {
        terminal = true;
        await destroyLocalCredential();
        const failure = {
          ...attemptRecord,
          status: "TERMINAL_FAILURE_NO_RETRY",
          localCredentialDestroyed: true,
          reason: error instanceof Error ? error.message.replaceAll(syntheticCredential, "[REDACTED]") : "UNKNOWN_FAILURE",
        };
        await durableExclusive(attemptsDirectory, `${String(attempt).padStart(2, "0")}-failure.json`,
          `${JSON.stringify(failure, null, 2)}\n`);
        throw error;
      } finally {
        credentialBytes?.fill(0);
      }
    });
    queue = operation.catch(() => undefined);
    return operation;
  };

  const revokeLocal = async () => {
    await queue;
    if (!revoked) {
      revoked = true; terminal = true;
      await destroyLocalCredential();
      await durableExclusive(leaseDirectory, "local-revocation.json", `${JSON.stringify({
        version: B3_CREDENTIAL_LIFECYCLE_VERSION, leaseId,
        status: "LOCAL_LEASE_REVOKED", providerSideApiKeyRevoked: false,
      }, null, 2)}\n`);
    }
    return Object.freeze({ localLeaseRevoked: true, providerSideApiKeyRevoked: false });
  };

  return Object.freeze({
    descriptor: () => Object.freeze({ ...descriptor }),
    dispatch,
    revokeLocal,
    status: () => Object.freeze({ nextAttempt: next + 1, completedOrConsumed: next, revoked, terminal }),
  });
}

export async function inspectB3SyntheticCredentialLease(leaseDirectory) {
  const directory = await assertPrivateDirectory(leaseDirectory);
  const lease = JSON.parse(await readFile(path.join(directory, "lease.json"), "utf8"));
  const attempts = await import("node:fs/promises").then(fs => fs.readdir(path.join(directory, "attempts")));
  let secretPresent = true;
  try { await stat(path.join(directory, "synthetic-credential.bin")); } catch (error) {
    if (error?.code === "ENOENT") secretPresent = false; else throw error;
  }
  return Object.freeze({
    version: lease.version, leaseId: lease.leaseId, secretPresent,
    admittedAttempts: attempts.filter(name => name.endsWith("-admitted.json")).length,
    completedReceipts: attempts.filter(name => name.endsWith("-receipt.json")).length,
    terminalFailures: attempts.filter(name => name.endsWith("-failure.json")).length,
    credentialMaterialExposed: false,
  });
}
