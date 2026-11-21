#!/usr/bin/env node

const baseUrl = (process.env.CREATOR_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const accessToken = process.env.CREATOR_ACCESS_TOKEN || "";

const checks = [];

async function runCheck(name, operation) {
  try {
    const detail = await operation();
    checks.push({ name, ok: true, detail });
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({ name, ok: false, detail: message });
    console.error(`✗ ${name} — ${message}`);
  }
}

async function expectStatus(path, expectedStatus, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...init,
  });

  if (response.status !== expectedStatus) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Expected HTTP ${expectedStatus}, received ${response.status}${body ? `: ${body.slice(0, 180)}` : ""}`,
    );
  }

  return response;
}

await runCheck("Creator workspace route", async () => {
  const response = await fetch(`${baseUrl}/create`, { redirect: "manual" });
  if (response.status !== 200 && response.status !== 307 && response.status !== 308) {
    throw new Error(`Unexpected HTTP ${response.status}`);
  }
  return `HTTP ${response.status}`;
});

if (accessToken) {
  await runCheck("Authenticated Creator health", async () => {
    const response = await expectStatus("/api/creator-health", 200, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await response.json();
    if (!body.requestId || !body.services) {
      throw new Error("Health response is missing requestId or services.");
    }
    return `${body.status} · ${body.release}`;
  });

  await runCheck("Authenticated analytics acceptance", async () => {
    const response = await expectStatus("/api/creator-analytics", 202, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        eventName: "workspace_opened",
        sessionId: `smoke-${Date.now()}`,
        stage: 1,
        projectState: "draft",
        metadata: {
          source: "creator-smoke-test",
          paidMedia: false,
        },
      }),
    });
    const body = await response.json();
    if (!body.accepted || !body.requestId) {
      throw new Error("Analytics response was not accepted.");
    }
    return `request ${body.requestId}`;
  });
} else {
  await runCheck("Health authentication guard", async () => {
    await expectStatus("/api/creator-health", 401);
    return "401 as expected";
  });

  await runCheck("Analytics authentication guard", async () => {
    await expectStatus("/api/creator-analytics", 401, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName: "workspace_opened",
        sessionId: "unauthenticated-smoke",
      }),
    });
    return "401 as expected";
  });
}

const failed = checks.filter((check) => !check.ok);

console.log("");
console.log(
  `CreatorLab smoke result: ${checks.length - failed.length}/${checks.length} checks passed.`,
);

if (failed.length > 0) {
  process.exitCode = 1;
}
