import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "velto-bounded-video-"));

try {
  const safeSource = fs.readFileSync("lib/security/safeRemoteMediaFetch.ts", "utf8")
    .replace(
      /import \{[\s\S]*?\} from "@\/lib\/security\/creatorMediaStoragePolicy";/,
      "const CREATOR_MEDIA_CONNECTION_TIMEOUT_MS = 10000; const CREATOR_MEDIA_TOTAL_TIMEOUT_MS = 30000;",
    );
  const safeTarget = path.join(temp, "safe.cjs");
  fs.writeFileSync(safeTarget, ts.transpileModule(safeSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);

  const boundedSource = fs.readFileSync("lib/security/boundedVideoResponse.ts", "utf8")
    .replace(
      /import \{[\s\S]*?\} from "@\/lib\/security\/safeRemoteMediaFetch";/,
      'const { SafeMediaError, verifyMediaBytes } = require("./safe.cjs");',
    );
  const boundedTarget = path.join(temp, "bounded.cjs");
  fs.writeFileSync(boundedTarget, ts.transpileModule(boundedSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  const { readBoundedVerifiedVideoResponse } = require(boundedTarget);

  const mp4 = Uint8Array.from([0, 0, 0, 12, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  const response = (chunks, headers = {}, onCancel = () => {}) => {
    const pending = [...chunks];
    return new Response(
      new ReadableStream({
        pull(controller) {
          const chunk = pending.shift();
          if (chunk) controller.enqueue(Uint8Array.from(chunk));
          else controller.close();
        },
        cancel: onCancel,
      }),
      { headers },
    );
  };
  const rejectsStatus = async (promise, status) => {
    await assert.rejects(promise, (error) => error?.status === status);
  };

  const valid = await readBoundedVerifiedVideoResponse(
    response([mp4.subarray(0, 5), mp4.subarray(5)], {
      "content-type": "video/mp4",
      "content-length": String(mp4.byteLength),
    }),
    32,
  );
  assert.equal(valid.mimeType, "video/mp4");
  assert.deepEqual([...valid.buffer], [...mp4]);

  let missingLengthCancelled = false;
  await rejectsStatus(
    readBoundedVerifiedVideoResponse(
      response([new Uint8Array(10), new Uint8Array(10)], { "content-type": "video/mp4" }, () => { missingLengthCancelled = true; }),
      16,
    ),
    413,
  );
  assert.equal(missingLengthCancelled, true);

  let falseLowCancelled = false;
  await rejectsStatus(
    readBoundedVerifiedVideoResponse(
      response([new Uint8Array(9), new Uint8Array(9)], { "content-type": "video/mp4", "content-length": "4" }, () => { falseLowCancelled = true; }),
      16,
    ),
    413,
  );
  assert.equal(falseLowCancelled, true);

  await rejectsStatus(
    readBoundedVerifiedVideoResponse(response([Uint8Array.from([1, 2, 3, 4])], { "content-type": "video/mp4" }), 32),
    415,
  );
  await rejectsStatus(
    readBoundedVerifiedVideoResponse(response([mp4], { "content-type": "video/webm" }), 32),
    415,
  );
  await rejectsStatus(
    readBoundedVerifiedVideoResponse(response([], { "content-type": "video/mp4", "content-length": "0" }), 32),
    422,
  );

  console.log("BETA-DATA-P1B-3B-2B-2C bounded synthetic stream tests passed.");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
