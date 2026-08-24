import { resolveProviderEnvironmentValue } from "../lib/runtime/providerEnvironment.mjs";

const API_BASE = "https://partner-content-api.epidemicsound.com";
const PARTNER_USER_ID = "velto-internal-entitlement-probe";
const SEARCH_TERM = "cinematic documentary";

const apiKey = resolveProviderEnvironmentValue("epidemic", "apiKey");
if (!apiKey) {
  console.error("EPIDEMIC_DOWNLOAD_ENTITLEMENT=CONFIGURATION_MISSING");
  console.error("Missing server-only EPIDEMIC_SOUND_API_KEY.");
  process.exitCode = 1;
} else {
  await runProbe(apiKey);
}

async function request(pathname, key) {
  return fetch(`${API_BASE}${pathname}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${key}`,
      "x-partner-user-id": PARTNER_USER_ID,
    },
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
}

async function safeJson(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function trackList(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  return Array.isArray(payload.tracks) ? payload.tracks : [];
}

function chooseTrack(tracks) {
  const valid = tracks.filter((candidate) => {
    return candidate && typeof candidate === "object" && text(candidate.id) && text(candidate.title);
  });
  return valid.find((candidate) => candidate.isPreviewOnly !== true) || valid[0];
}

function findSignedUrl(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return "";
  seen.add(value);
  for (const [key, candidate] of Object.entries(value)) {
    if (typeof candidate === "string" && /url/i.test(key) && /^https:\/\//i.test(candidate)) {
      return candidate;
    }
  }
  for (const candidate of Object.values(value)) {
    const found = findSignedUrl(candidate, seen);
    if (found) return found;
  }
  return "";
}

function explicitExpiry(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return "";
  seen.add(value);
  for (const [key, candidate] of Object.entries(value)) {
    if (/^(expires|expiresAt|expires_at|expiry|expiration)$/i.test(key)) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        const millis = candidate < 10_000_000_000 ? candidate * 1000 : candidate;
        return new Date(millis).toISOString();
      }
    }
  }
  for (const candidate of Object.values(value)) {
    const found = explicitExpiry(candidate, seen);
    if (found) return found;
  }
  return "";
}

function signedUrlExpiry(signedUrl) {
  if (!signedUrl) return "";
  try {
    const parsed = new URL(signedUrl);
    const epoch = parsed.searchParams.get("Expires");
    if (epoch && /^\d+$/.test(epoch)) return new Date(Number(epoch) * 1000).toISOString();
    const signedAt = parsed.searchParams.get("X-Amz-Date");
    const lifetime = parsed.searchParams.get("X-Amz-Expires");
    if (signedAt && /^\d{8}T\d{6}Z$/.test(signedAt) && lifetime && /^\d+$/.test(lifetime)) {
      const timestamp = Date.UTC(
        Number(signedAt.slice(0, 4)), Number(signedAt.slice(4, 6)) - 1,
        Number(signedAt.slice(6, 8)), Number(signedAt.slice(9, 11)),
        Number(signedAt.slice(11, 13)), Number(signedAt.slice(13, 15)),
      );
      return new Date(timestamp + Number(lifetime) * 1000).toISOString();
    }
  } catch {
    return "";
  }
  return "";
}

function classification(status) {
  if (status === 403) return "EPIDEMIC_DOWNLOAD_ENTITLEMENT=NOT_AUTHORIZED";
  if (status === 401) return "EPIDEMIC_DOWNLOAD_ENTITLEMENT=AUTHENTICATION_ERROR";
  if (status === 429) return "EPIDEMIC_DOWNLOAD_ENTITLEMENT=RATE_LIMITED";
  return "EPIDEMIC_DOWNLOAD_ENTITLEMENT=UPSTREAM_ERROR";
}

async function runProbe(key) {
  const searchParams = new URLSearchParams({ term: SEARCH_TERM, limit: "20", offset: "0" });
  const searchResponse = await request(`/v0/tracks/search?${searchParams}`, key);
  const searchPayload = await safeJson(searchResponse);
  if (!searchResponse.ok) {
    console.log(`EPIDEMIC_SEARCH_HTTP_STATUS=${searchResponse.status}`);
    console.log(classification(searchResponse.status));
    process.exitCode = 1;
    return;
  }

  const track = chooseTrack(trackList(searchPayload));
  if (!track) {
    console.log("EPIDEMIC_SEARCH_HTTP_STATUS=200");
    console.log("EPIDEMIC_DOWNLOAD_ENTITLEMENT=UPSTREAM_ERROR");
    console.error("Search returned no track with a valid id and title.");
    process.exitCode = 1;
    return;
  }

  console.log(`TRACK_ID=${text(track.id)}`);
  console.log(`TRACK_TITLE=${text(track.title)}`);
  console.log(`TRACK_IS_PREVIEW_ONLY=${typeof track.isPreviewOnly === "boolean" ? track.isPreviewOnly : "not_returned"}`);

  const trackId = encodeURIComponent(text(track.id));
  const downloadResponse = await request(`/v0/tracks/${trackId}/download?format=mp3&quality=normal`, key);
  const downloadPayload = await safeJson(downloadResponse);
  console.log(`EPIDEMIC_DOWNLOAD_HTTP_STATUS=${downloadResponse.status}`);

  if (downloadResponse.status !== 200) {
    console.log(classification(downloadResponse.status));
    console.log("SIGNED_DOWNLOAD_URL_RETURNED=false");
    return;
  }

  const signedUrl = findSignedUrl(downloadPayload);
  let hostname = "not_returned";
  if (signedUrl) {
    try {
      hostname = new URL(signedUrl).hostname;
    } catch {
      hostname = "invalid";
    }
  }
  const expiry = explicitExpiry(downloadPayload) || signedUrlExpiry(signedUrl) || "not_returned";
  console.log("EPIDEMIC_DOWNLOAD_ENTITLEMENT=AUTHORIZED");
  console.log(`SIGNED_DOWNLOAD_URL_RETURNED=${Boolean(signedUrl)}`);
  console.log(`SIGNED_DOWNLOAD_URL_EXPIRY=${expiry}`);
  console.log(`SIGNED_DOWNLOAD_URL_HOSTNAME=${hostname}`);
}
