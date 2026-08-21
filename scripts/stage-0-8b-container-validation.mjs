import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const root = process.cwd();
const project = "velto-stage-08b-validation";
const envFile = path.join(root, ".env.local");
const validationPort = await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      reject(new Error("Could not reserve a local validation port."));
      return;
    }
    server.close((error) => error ? reject(error) : resolve(address.port));
  });
});
const commandEnvironment = {
  ...process.env,
  VELTO_HOST_PORT: String(validationPort),
};
const composeArgs = [
  "compose",
  "--project-name",
  project,
  "--env-file",
  envFile,
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: options.timeout ?? 120_000,
    stdio: options.stdio ?? "pipe",
    env: commandEnvironment,
  });

  if (result.error || result.status !== 0) {
    const detail = [result.error?.message, result.stderr, result.stdout]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(`${command} ${args.join(" ")} failed${detail ? `:\n${detail}` : "."}`);
  }

  return typeof result.stdout === "string" ? result.stdout.trim() : "";
}

function compose(args, options) {
  return run("docker", [...composeArgs, ...args], options);
}

function parseServerSecrets() {
  const content = fs.readFileSync(envFile, "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
      return { key, value };
    })
    .filter(({ key, value }) =>
      !key.startsWith("NEXT_PUBLIC_") &&
      Boolean(value) &&
      !value.startsWith("replace-with-") &&
      !value.includes("your-project"),
    );
}

async function waitForJson(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "no response";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
      const body = await response.json();
      if (response.ok && body?.ok === true) return body;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`${url} did not become healthy: ${lastError}`);
}

function containerId(service) {
  return compose(["ps", "-q", service]);
}

if (!fs.existsSync(envFile)) {
  throw new Error(".env.local is required for Stage 0.8B container validation.");
}

run("docker", ["info", "--format", "{{.ServerVersion}}"], { timeout: 20_000 });
compose(["config", "--quiet"]);
console.log("PASS compose configuration");

let compositionStarted = false;

try {
  compose(["build", "velto", "worker"], { timeout: 1_200_000, stdio: "inherit" });
  const runnerImage = `${project}-velto:latest`;
  run("docker", ["image", "inspect", runnerImage]);
  console.log("PASS runner and worker image builds");

  const configuredUser = run("docker", [
    "image",
    "inspect",
    "--format",
    "{{.Config.User}}",
    runnerImage,
  ]);
  if (!configuredUser || configuredUser === "0" || configuredUser === "root") {
    throw new Error(`Runner image has an unsafe runtime user: ${configuredUser || "unset"}`);
  }

  const nativeProbe = String.raw`
    const fs = require("node:fs");
    const { spawnSync } = require("node:child_process");
    const ffmpeg = require("ffmpeg-static");
    const packagedFfprobe = require("ffprobe-static").path;
    const ffprobe = fs.existsSync(packagedFfprobe) ? packagedFfprobe : "/usr/bin/ffprobe";
    if (!ffmpeg || !ffprobe) throw new Error("native executable path missing");
    if (process.getuid?.() === 0) throw new Error("runtime user is root");
    for (const executable of [ffmpeg, ffprobe]) fs.accessSync(executable, fs.constants.X_OK);
    let rootReadOnly = false;
    try { fs.writeFileSync("/app/stage-08b-write-check", "blocked"); }
    catch (error) { rootReadOnly = error?.code === "EROFS" || error?.code === "EACCES"; }
    if (!rootReadOnly) throw new Error("application root accepted a write");
    const output = "/tmp/stage-08b-native.mp4";
    fs.writeFileSync("/tmp/stage-08b-write-check", "ok");
    const ffmpegVersion = spawnSync(ffmpeg, ["-version"], { encoding: "utf8" });
    if (ffmpegVersion.status !== 0) throw new Error("ffmpeg -version failed");
    const ffprobeVersion = spawnSync(ffprobe, ["-version"], { encoding: "utf8" });
    if (ffprobeVersion.status !== 0) throw new Error("ffprobe -version failed");
    const generate = spawnSync(ffmpeg, ["-y", "-f", "lavfi", "-i", "color=c=black:s=16x16:d=0.1", "-frames:v", "1", output], { encoding: "utf8" });
    if (generate.status !== 0) throw new Error("minimal ffmpeg operation failed");
    const probe = spawnSync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1", output], { encoding: "utf8" });
    if (probe.status !== 0 || !probe.stdout.includes("duration=")) throw new Error("minimal ffprobe operation failed");
    console.log(JSON.stringify({ nonRoot: true, rootReadOnly: true, tmpWritable: true, ffmpeg: true, ffprobe: true, mediaOperation: true }));
  `;

  run("docker", [
    "run",
    "--rm",
    "--read-only",
    "--tmpfs",
    "/tmp:size=64m,mode=1777",
    "--entrypoint",
    "node",
    runnerImage,
    "-e",
    nativeProbe,
  ]);
  console.log("PASS non-root, read-only root, writable /tmp, ffmpeg, ffprobe, and native media operation");

  const metadata = [
    run("docker", ["image", "inspect", runnerImage]),
    run("docker", ["history", "--no-trunc", "--format", "{{.CreatedBy}}", runnerImage]),
  ].join("\n");
  for (const { key, value } of parseServerSecrets()) {
    if (metadata.includes(value)) {
      throw new Error(`Runner image metadata contains the server secret identified by ${key}.`);
    }
  }
  run("docker", [
    "run",
    "--rm",
    "--entrypoint",
    "node",
    runnerImage,
    "-e",
    "const fs=require('node:fs'); for (const p of ['/app/.env','/app/.env.local','/app/.env.production']) if(fs.existsSync(p)) process.exit(1)",
  ]);
  console.log("PASS image secret hygiene");

  compositionStarted = true;
  compose(["up", "-d", "worker"], { timeout: 300_000 });
  await waitForJson(`http://127.0.0.1:${validationPort}/api/runtime-health?mode=live`, 180_000);
  await waitForJson(`http://127.0.0.1:${validationPort}/api/runtime-health?mode=ready`, 30_000);

  const webId = containerId("velto");
  const workerId = containerId("worker");
  if (!webId || !workerId) throw new Error("Compose web or worker container is missing.");
  const workerRunning = run("docker", ["inspect", "--format", "{{.State.Running}}", workerId]);
  if (workerRunning !== "true") throw new Error("Worker did not reach running state.");

  const workerStartedAt = Date.parse(run("docker", ["inspect", "--format", "{{.State.StartedAt}}", workerId]));
  const healthJson = run("docker", ["inspect", "--format", "{{json .State.Health.Log}}", webId]);
  const firstReady = JSON.parse(healthJson).find((entry) => entry.ExitCode === 0);
  if (!firstReady || workerStartedAt < Date.parse(firstReady.End)) {
    throw new Error("Worker started before the web readiness healthcheck succeeded.");
  }
  console.log("PASS live endpoint, ready endpoint, and Compose readiness ordering");

  compose(["stop", "--timeout", "90", "worker"], { timeout: 110_000 });
  const workerExitCode = run("docker", ["inspect", "--format", "{{.State.ExitCode}}", workerId]);
  if (workerExitCode !== "0") throw new Error(`Worker SIGTERM exit code was ${workerExitCode}.`);
  console.log("PASS idle worker SIGTERM shutdown");
} finally {
  if (compositionStarted) {
    compose(["down", "--remove-orphans"], { timeout: 120_000, stdio: "inherit" });
  }
}

console.log("Stage 0.8B behavioral container validation passed.");
