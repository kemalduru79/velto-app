import assert from "node:assert/strict";
import fs from "node:fs";

const dockerfile = fs.readFileSync("export-service/Dockerfile", "utf8");
const service = fs.readFileSync("export-service/src/server.js", "utf8");
const dockerignore = fs.readFileSync("export-service/.dockerignore", "utf8");

assert.match(dockerfile, /^FROM node:22-bookworm-slim$/m);
assert.match(dockerfile, /RUN npm ci --omit=dev/);
assert.doesNotMatch(dockerfile, /npm install/);
assert.match(dockerfile, /^USER node$/m);
assert.match(dockerfile, /^CMD \["node", "src\/server\.js"\]$/m);
assert.doesNotMatch(dockerfile, /CMD \["npm"|npm start/);
assert.match(dockerfile, /^HEALTHCHECK /m);
assert.match(dockerfile, /process\.env\.PORT\|\|'3001'/);
assert.match(dockerfile, /127\.0\.0\.1:'\+port\+'\/health/);
assert.match(dockerfile, /^STOPSIGNAL SIGTERM$/m);
assert.doesNotMatch(
  dockerfile,
  /\b(?:ARG|ENV)\s+(?:SUPABASE_SERVICE_ROLE_KEY|VELTO_INTERNAL_EXPORT_TOKEN|OPENAI_API_KEY|RUNWAY_API_KEY|RUNWAYML_API_SECRET|RUNWAYML_API_KEY|VEO_API_KEY|GEMINI_API_KEY|ELEVENLABS_API_KEY|YOUTUBE_API_KEY)\b/,
);

assert.match(service, /app\.get\("\/health",[\s\S]*stitchContinuityVersion: "3N-4"/);
assert.match(service, /const port = Number\(process\.env\.PORT \|\| 3001\)/);
assert.match(service, /const server = app\.listen\(port/);
assert.match(service, /let shuttingDown = false/);
assert.match(service, /if \(shuttingDown\) return/);
assert.match(service, /server\.close\(\(\) => process\.exit\(0\)\)/);
assert.match(service, /process\.on\("SIGTERM", shutdown\)/);
assert.match(service, /process\.on\("SIGINT", shutdown\)/);
assert.match(service, /os\.tmpdir\(\)/);
assert.match(service, /fs\.promises\.rm\(tempDir, \{ recursive: true, force: true \}\)/);

for (const marker of [
  "SCENE_TRANSITION_TRIM_SECONDS",
  "MIN_AUDIO_TAIL_BUFFER_SECONDS",
  "SPEECH_FREEZE_TAIL_BUFFER_SECONDS",
  "AMBIENT_DEFAULT_VOLUME",
  "AMBIENT_MAX_VOLUME",
  "normalizeCreatorVideoTrim",
  "probeMediaStreams",
  "verifyRenderedContinuity",
]) {
  assert.match(service, new RegExp(`\\b${marker}\\b`));
}

for (const exclusion of [
  "node_modules",
  ".env",
  ".env.*",
  "npm-debug.log*",
]) {
  assert.ok(dockerignore.split(/\r?\n/).includes(exclusion));
}

console.log("Stage 0.8E-A export runtime regression passed.");
