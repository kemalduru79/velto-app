import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const corpus = JSON.parse(fs.readFileSync("scripts/fixtures/issue50-public-corpus-v1.json"));
assert.equal(corpus.state, "PUBLISHER_HTTPS_AND_BYTE_BINDINGS_VERIFIED_NOT_OWNER_ACCEPTED");
assert.equal(corpus.providerCalls, 0);
assert.equal(corpus.sources.length, 2);
let passages = 0;
for (const [i, source] of corpus.sources.entries()) {
  assert.equal(new URL(source.url).protocol, "https:");
  assert.equal(new URL(source.url).hostname, ["support.apple.com", "www.digitalpreservation.gov"][i]);
  assert.match(source.documentSha256, /^[a-f0-9]{64}$/);
  const bytes = process.argv[2] ? fs.readFileSync(path.join(process.argv[2], `source-${i + 1}.html`)) : null;
  if (bytes) { assert.equal(hash(bytes), source.documentSha256); assert.equal(bytes.length, source.documentBytes); }
  for (const passage of source.passages) {
    assert.equal(hash(passage.excerpt), passage.excerptSha256);
    assert.ok(passage.documentByteStart >= 0 && passage.documentByteEnd > passage.documentByteStart && passage.documentByteEnd <= source.documentBytes);
    if (bytes) assert.equal(hash(bytes.subarray(passage.documentByteStart, passage.documentByteEnd)), passage.rawSha256);
    passages++;
  }
}
assert.equal(passages, 5);
console.log(JSON.stringify({ status: "PASS", sources: 2, passages, documentBytesReverified: Boolean(process.argv[2]), ownerAccepted: false, canonicalGenerationIntakeQualified: false, providerCalls: 0 }));
