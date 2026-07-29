const baseUrl = (process.env.VELTO_BASE_URL || "http://localhost:3000").replace(
  /\/+$/,
  "",
);

async function check(mode) {
  const response = await fetch(
    `${baseUrl}/api/runtime-health?mode=${encodeURIComponent(mode)}`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  const body = await response.json().catch(() => null);

  console.log(
    JSON.stringify(
      {
        mode,
        status: response.status,
        ok: response.ok,
        body,
      },
      null,
      2,
    ),
  );

  return response.ok;
}

const liveOk = await check("live");
const readyOk = await check("ready");

if (!liveOk) {
  console.error("RUN-P1 liveness check failed.");
  process.exit(1);
}

if (!readyOk) {
  console.error(
    "RUN-P1 readiness check failed. Review the missing environment keys above.",
  );
  process.exit(2);
}

console.log("RUN-P1 container runtime checks passed.");
