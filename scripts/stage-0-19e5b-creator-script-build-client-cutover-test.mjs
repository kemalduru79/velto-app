import assert from "node:assert/strict";
import fs from "node:fs";

import {
  CREATOR_SCRIPT_BUILD_MAX_ADVANCES,
  CreatorScriptBuildClientError,
  creatorScriptBuildProgressMessage,
  creatorScriptBuildV2ClientEnabled,
  creatorScriptBuildV2RecoveryMessage,
  runCreatorScriptBuildV2,
} from "../lib/creator/creatorScriptBuildClient.ts";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function projection(state, overrides = {}) {
  return {
    success: !["FAILED", "STALE"].includes(state),
    version: "0.19E5A",
    buildId: "build-e5b-1",
    state,
    terminal: ["PERSISTED", "FAILED", "STALE"].includes(state),
    disposition: "ADVANCED",
    failure: null,
    ...overrides,
  };
}

// 1-3. Feature flag semantics are explicit and default OFF.
assert.equal(creatorScriptBuildV2ClientEnabled(undefined), false);
assert.equal(creatorScriptBuildV2ClientEnabled("false"), false);
assert.equal(creatorScriptBuildV2ClientEnabled("TRUE"), true);

// 4-12. V2 uses one facade, start authority is narrow, and advances are generic.
{
  const calls = [];
  const queue = [
    jsonResponse(projection("REQUESTED", { disposition: "CREATED" })),
    jsonResponse(projection("EDITORIAL_COMPILED")),
    jsonResponse(projection("AUTHORITY_RESOLVED")),
    jsonResponse(projection("SCRIPT_GENERATED")),
    jsonResponse(projection("ACCEPTED")),
    jsonResponse(projection("PERSISTED", {
      creatorScript: {
        version: "0.10H-2I",
        title: "Canonical script",
      },
      persistence: {
        installedProjectRevision: "2026-10-03T18:00:00.000Z",
      },
    })),
  ];
  const progress = [];

  const result = await runCreatorScriptBuildV2({
    accessToken: "token",
    projectId: "project-1",
    expectedProjectUpdatedAt: "2026-10-03T17:00:00.000Z",
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      const response = queue.shift();
      assert.ok(response, "unexpected request");
      return response;
    },
    onProgress: (value) => progress.push(value.state),
  });

  assert.equal(result.state, "PERSISTED");
  assert.deepEqual(progress, [
    "REQUESTED",
    "EDITORIAL_COMPILED",
    "AUTHORITY_RESOLVED",
    "SCRIPT_GENERATED",
    "ACCEPTED",
    "PERSISTED",
  ]);

  const startBody = JSON.parse(calls[0].init.body);
  assert.deepEqual(startBody, {
    action: "start",
    projectId: "project-1",
    expectedProjectUpdatedAt: "2026-10-03T17:00:00.000Z",
  });
  assert.equal(Object.hasOwn(startBody, "topic"), false);
  assert.equal(Object.hasOwn(startBody, "durationSec"), false);
  assert.equal(Object.hasOwn(startBody, "strategyFingerprint"), false);
  assert.equal(Object.hasOwn(startBody, "creatorProfile"), false);
  assert.equal(Object.hasOwn(startBody, "contractVersions"), false);

  for (const call of calls.slice(1)) {
    assert.equal(call.url, "/api/creator-script-build");
    assert.deepEqual(JSON.parse(call.init.body), {
      action: "advance",
      buildId: "build-e5b-1",
    });
  }
}

// 13-16. Terminal FAILED/STALE stop immediately; no silent legacy or extra advance.
for (const terminal of [
  projection("FAILED", {
    success: false,
    failure: {
      category: "SCRIPT_POLICY",
      code: "CREATOR_SCRIPT_BUILD_SCRIPT_REJECTED",
      retryability: "NON_RETRYABLE",
    },
  }),
  projection("STALE", {
    success: false,
    failure: {
      category: "AUTHORITY",
      code: "CREATOR_SCRIPT_BUILD_PROJECT_STALE",
      retryability: "NON_RETRYABLE",
    },
  }),
]) {
  let calls = 0;
  const result = await runCreatorScriptBuildV2({
    accessToken: "token",
    projectId: "project-1",
    expectedProjectUpdatedAt: "2026-10-03T17:00:00.000Z",
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse(terminal, terminal.state === "STALE" ? 409 : 422);
    },
  });
  assert.equal(result.state, terminal.state);
  assert.equal(calls, 1);
}

// 17-20. Lost START response retries the exact same semantic start.
{
  const bodies = [];
  let attempt = 0;
  const result = await runCreatorScriptBuildV2({
    accessToken: "token",
    projectId: "project-1",
    expectedProjectUpdatedAt: "2026-10-03T17:00:00.000Z",
    fetchImpl: async (_url, init = {}) => {
      bodies.push(init.body);
      attempt += 1;
      if (attempt === 1) throw new TypeError("lost response");
      return jsonResponse(projection("PERSISTED", {
        creatorScript: { title: "same build" },
        persistence: {
          installedProjectRevision: "2026-10-03T18:00:00.000Z",
        },
      }));
    },
  });
  assert.equal(result.state, "PERSISTED");
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
}

// 21-27. Lost ADVANCE response reconciles durable status, then reuses same buildId.
{
  const calls = [];
  let phase = 0;
  const result = await runCreatorScriptBuildV2({
    accessToken: "token",
    projectId: "project-1",
    expectedProjectUpdatedAt: "2026-10-03T17:00:00.000Z",
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), method: init.method, body: init.body });
      phase += 1;
      if (phase === 1) return jsonResponse(projection("AUTHORITY_RESOLVED"));
      if (phase === 2) throw new TypeError("lost advance response");
      if (phase === 3) {
        assert.match(String(url), /^\/api\/creator-script-build\?buildId=/u);
        return jsonResponse(projection("SCRIPT_GENERATED"));
      }
      if (phase === 4) {
        return jsonResponse(projection("PERSISTED", {
          creatorScript: { title: "resumed" },
          persistence: {
            installedProjectRevision: "2026-10-03T18:00:00.000Z",
          },
        }));
      }
      throw new Error("unexpected request");
    },
  });

  assert.equal(result.state, "PERSISTED");
  assert.deepEqual(JSON.parse(calls[1].body), {
    action: "advance",
    buildId: "build-e5b-1",
  });
  assert.deepEqual(JSON.parse(calls[3].body), {
    action: "advance",
    buildId: "build-e5b-1",
  });
}

// 28-30. A terminal durable status discovered after a lost response prevents retry.
{
  let calls = 0;
  const result = await runCreatorScriptBuildV2({
    accessToken: "token",
    projectId: "project-1",
    expectedProjectUpdatedAt: "2026-10-03T17:00:00.000Z",
    fetchImpl: async (_url, _init = {}) => {
      calls += 1;
      if (calls === 1) return jsonResponse(projection("AUTHORITY_RESOLVED"));
      if (calls === 2) throw new TypeError("lost response");
      if (calls === 3) {
        return jsonResponse(projection("PERSISTED", {
          creatorScript: { title: "already persisted" },
          persistence: {
            installedProjectRevision: "2026-10-03T18:00:00.000Z",
          },
        }));
      }
      throw new Error("advance must not be retried after terminal status");
    },
  });
  assert.equal(result.state, "PERSISTED");
  assert.equal(calls, 3);
}

// 31-33. Finite safety bound prevents an infinite browser loop.
{
  let calls = 0;
  await assert.rejects(
    runCreatorScriptBuildV2({
      accessToken: "token",
      projectId: "project-1",
      expectedProjectUpdatedAt: "2026-10-03T17:00:00.000Z",
      maxAdvances: 2,
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse(projection("REQUESTED"));
      },
    }),
    (error) => {
      assert.ok(error instanceof CreatorScriptBuildClientError);
      assert.equal(error.code, "CREATOR_SCRIPT_BUILD_ADVANCE_LIMIT_EXCEEDED");
      return true;
    },
  );
  assert.equal(calls, 3); // start + exactly 2 advances
  assert.equal(CREATOR_SCRIPT_BUILD_MAX_ADVANCES, 12);
}

// 34-37. Bounded API errors do not expose raw provider/database messages.
{
  await assert.rejects(
    runCreatorScriptBuildV2({
      accessToken: "token",
      projectId: "project-1",
      expectedProjectUpdatedAt: "2026-10-03T17:00:00.000Z",
      fetchImpl: async () => jsonResponse({
        success: false,
        code: "BUILD_STATE_CONFLICT",
        error: "raw database detail must not matter",
      }, 409),
    }),
    (error) => {
      assert.ok(error instanceof CreatorScriptBuildClientError);
      assert.equal(error.code, "BUILD_STATE_CONFLICT");
      assert.equal(error.message, "BUILD_STATE_CONFLICT");
      assert.doesNotMatch(error.message, /database|provider|openai|supabase/iu);
      return true;
    },
  );
}

// 38. System ACCEPTED is presentation-only "Saving", never human approval.
assert.equal(
  creatorScriptBuildProgressMessage({ state: "ACCEPTED", language: "en" }),
  "Saving script…",
);
assert.doesNotMatch(
  creatorScriptBuildProgressMessage({ state: "ACCEPTED", language: "en" }),
  /approved/iu,
);

// 39. Recovery copy never advises legacy fallback.
assert.doesNotMatch(
  creatorScriptBuildV2RecoveryMessage({
    code: "BUILD_STATE_CONFLICT",
    language: "en",
  }),
  /fallback|legacy flow instead/iu,
);

// 40-50. Static cutover architecture guards.
{
  const clientSource = fs.readFileSync(
    new URL("../lib/creator/creatorScriptBuildClient.ts", import.meta.url),
    "utf8",
  );
  const pageSource = fs.readFileSync(
    new URL("../app/create/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(clientSource, /NEXT_PUBLIC_CREATOR_SCRIPT_BUILD_V2_ENABLED/u);
  assert.match(clientSource, /\/api\/creator-script-build/u);
  assert.doesNotMatch(
    clientSource,
    /\/api\/creator-(?:research|editorial-analysis|editorial-primary-coverage|script-plan)/u,
  );
  assert.doesNotMatch(
    clientSource,
    /switch\s*\(\s*current\.state\s*\)|if\s*\(\s*current\.state\s*===/u,
  );
  assert.match(clientSource, /if \(current\.terminal\) return current/u);

  const handlerStart = pageSource.indexOf(
    "const handleCreatorProductionPackage = async",
  );
  const handlerEnd = pageSource.indexOf(
    "const handleApproveCreatorScriptAndBuildScenes",
    handlerStart,
  );
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
  const handler = pageSource.slice(handlerStart, handlerEnd);

  const saveIndex = handler.indexOf("persistCreatorStrategyAuthority");
  const v2Index = handler.indexOf("if (creatorScriptBuildV2ClientEnabled())");
  const legacyIndex = handler.indexOf("runCreatorEditorialScriptPipeline");
  assert.ok(saveIndex >= 0);
  assert.ok(v2Index > saveIndex);
  assert.ok(legacyIndex > v2Index);

  assert.match(
    handler,
    /expectedProjectUpdatedAt:\s*projectUpdatedAtRef\.current/u,
  );
  assert.match(
    handler,
    /runCreatorScriptBuildV2\(\{[\s\S]*?accessToken,[\s\S]*?projectId:\s*operationOrigin\.projectId,[\s\S]*?expectedProjectUpdatedAt:\s*projectUpdatedAtRef\.current/u,
  );
  assert.match(
    handler,
    /await loadProject\(operationOrigin\.projectId\)/u,
  );
  assert.match(
    handler,
    /beginCreatorScriptGenerationFlight/u,
  );
  assert.match(
    handler,
    /finishCreatorScriptGenerationFlight/u,
  );
  assert.match(
    handler,
    /CreatorScriptBuildClientError/u,
  );

  // Legacy pipeline remains present behind the flag-OFF branch.
  assert.match(handler, /runCreatorEditorialScriptPipeline/u);

  // The V2 branch never invokes legacy stage endpoints directly.
  const v2Branch = handler.slice(v2Index, legacyIndex);
  assert.doesNotMatch(
    v2Branch,
    /\/api\/creator-(?:research|editorial-analysis|editorial-primary-coverage|script-plan)/u,
  );
}

console.log("stage-0-19e5b-creator-script-build-client-cutover-test: PASS");
