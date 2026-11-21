import { readFile } from "node:fs/promises";

const [fixturePath, spanId, sourceId] = process.argv.slice(2);
if (!fixturePath || !spanId || !sourceId) {
  throw new Error("Usage: node scripts/stage-0-15b-6j-review-captured-span.mjs <captured-request.json> <spanId> <sourceId>");
}

const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const candidates = [];
function collect(value) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(collect);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if ((key === "candidateSpans" || key === "discoveryCandidateSpans") && Array.isArray(child)) {
      candidates.push(...child);
    } else {
      collect(child);
    }
  }
}
collect(fixture);

const matches = candidates.filter((candidate) =>
  candidate?.spanId === spanId && candidate?.sourceId === sourceId
);
if (matches.length === 0) throw new Error("Captured candidate span was not found.");
const texts = [...new Set(matches.map((candidate) => candidate?.text).filter((text) => typeof text === "string"))];
if (texts.length !== 1) throw new Error("Captured candidate span identity is ambiguous.");
process.stdout.write(`${texts[0]}\n`);
