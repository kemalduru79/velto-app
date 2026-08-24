import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const BASE_URL = "https://api.storyblocks.com";
const USER_ID = "velto-internal-001";
const PROJECT_ID = "storyblocks-relevance-gate-2026-08";
const OUTPUT_PATH = "tmp/storyblocks-search-evaluation.json";

const publicKey = process.env.STORYBLOCKS_PUBLIC_KEY?.trim();
const secretKey = process.env.STORYBLOCKS_SECRET_KEY?.trim();

if (!publicKey || !secretKey) {
  const missing = [
    !publicKey && "STORYBLOCKS_PUBLIC_KEY",
    !secretKey && "STORYBLOCKS_SECRET_KEY",
  ].filter(Boolean);
  throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
}

const videoQueries = [
  "supersonic passenger aircraft taking off",
  "1970s international airport terminal",
  "aviation engineer working on aircraft",
  "commercial airplane cockpit close up",
  "New York skyline aerial",
  "aircraft flying above clouds",
  "vintage passenger airplane interior",
  "jet engine close up",
  "airport runway at sunset",
  "aviation control tower",
];

const imageQueries = [
  "vintage airport terminal",
  "passenger aircraft cockpit",
  "New York skyline aerial",
];

const audioQueries = [
  "cinematic documentary technology",
  "inspiring aviation documentary",
  "suspenseful historical documentary",
];

function redact(value, signature = "") {
  return String(value)
    .replaceAll(secretKey, "[REDACTED_SECRET]")
    .replaceAll(publicKey, "[REDACTED_PUBLIC_KEY]")
    .replaceAll(signature, signature ? "[REDACTED_HMAC]" : "");
}

function hmacFor(resource, expires) {
  return createHmac("sha256", `${secretKey}${expires}`)
    .update(resource)
    .digest("hex");
}

function firstPresent(object, keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function stringList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "object" && item
          ? firstPresent(item, ["name", "title", "value", "label", "keyword"])
          : item,
      )
      .filter((item) => item !== null && item !== undefined && item !== "")
      .map(String);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function previewUrls(item) {
  const values = [
    firstPresent(item, [
      "preview_url",
      "previewUrl",
      "thumbnail_url",
      "thumbnailUrl",
      "image_url",
      "imageUrl",
      "waveform_url",
    ]),
    ...Object.values(firstPresent(item, ["preview_urls", "previewUrls"]) || {}),
  ];
  return [...new Set(values.filter((value) => typeof value === "string"))];
}

function normalizeResult(item) {
  const durationMs = firstPresent(item, ["durationMs", "duration_ms"]);
  const durationSeconds = firstPresent(item, ["duration", "duration_seconds"]);
  const keywords = [
    ...stringList(firstPresent(item, ["keywords", "tags", "topTags", "top_tags"])),
    ...stringList(firstPresent(item, ["moods"])),
    ...stringList(firstPresent(item, ["genres"])),
  ];

  return {
    id: firstPresent(item, ["id", "stock_item_id", "stockItemId", "asset_id"]),
    title: firstPresent(item, ["title", "name"]),
    description: firstPresent(item, ["description", "caption"]),
    previewUrls: previewUrls(item),
    durationMs:
      typeof durationMs === "number"
        ? durationMs
        : typeof durationSeconds === "number"
          ? durationSeconds * 1000
          : null,
    maxResolution: firstPresent(item, ["maxResolution", "max_resolution", "quality"]),
    aspectRatio: firstPresent(item, ["aspectRatio", "aspect_ratio", "orientation"]),
    bpm: firstPresent(item, ["bpm", "beats_per_minute"]),
    keywords: [...new Set(keywords)].slice(0, 12),
    responseKeys: Object.keys(item).sort(),
  };
}

function responseResults(body) {
  if (Array.isArray(body?.results)) return body.results;
  if (Array.isArray(body?.data?.results)) return body.data.results;
  if (Array.isArray(body?.items)) return body.items;
  if (Array.isArray(body?.data)) return body.data;
  return [];
}

class StoryblocksRequestError extends Error {
  constructor(message, { status, category, response }) {
    super(message);
    this.name = "StoryblocksRequestError";
    this.status = status;
    this.category = category;
    this.response = response;
  }
}

async function search(mediaType, query) {
  const resource = `/api/v2/${mediaType}/search`;
  assert(!resource.includes("download"), "Evaluation must never call a download endpoint");

  const expires = String(Math.floor(Date.now() / 1000) + 3600);
  const signature = hmacFor(resource, expires);
  const params = new URLSearchParams({
    APIKEY: publicKey,
    EXPIRES: expires,
    HMAC: signature,
    user_id: USER_ID,
    project_id: PROJECT_ID,
    keywords: query,
    results_per_page: "10",
    page: "1",
    sort_by: "most_relevant",
    safe_search: "true",
  });

  if (mediaType === "videos") {
    params.set("orientation", "horizontal");
    params.set(
      "extended",
      "description,keywords,durationMs,maxResolution,aspectRatio,dateAdded",
    );
  } else if (mediaType === "images") {
    params.set("orientation", "horizontal");
    params.set("extended", "description,keywords,maxResolution,aspectRatio,dateAdded");
  } else {
    params.set("content_type", "music");
    params.set("extended", "moods,genres,bpm,durationMs,keywords,topTags,dateAdded");
  }

  const response = await fetch(`${BASE_URL}${resource}?${params}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  const responseText = await response.text();
  let body;
  try {
    body = responseText ? JSON.parse(responseText) : null;
  } catch {
    body = responseText;
  }

  if (!response.ok) {
    const category =
      response.status === 401 || response.status === 403
        ? "authentication"
        : response.status === 429
          ? "rate_limit"
          : "api";
    const safeResponse = redact(
      typeof body === "string" ? body : JSON.stringify(body),
      signature,
    ).slice(0, 2_000);
    throw new StoryblocksRequestError(
      `Storyblocks ${category} error (${response.status})`,
      { status: response.status, category, response: safeResponse },
    );
  }

  const rawResults = responseResults(body).slice(0, 10);
  return {
    mediaType,
    query,
    ok: true,
    status: response.status,
    received: rawResults.length,
    totalResults: firstPresent(body, ["total_results", "totalResults", "total"]),
    responseKeys:
      body && typeof body === "object" && !Array.isArray(body)
        ? Object.keys(body).sort()
        : [],
    results: rawResults.map(normalizeResult),
  };
}

function printResult(entry) {
  console.log(`\n[${entry.mediaType.toUpperCase()}] ${entry.query}`);
  if (!entry.ok) {
    console.log(`FAILED: ${entry.category} (${entry.status ?? "no status"})`);
    console.log(entry.error);
    return;
  }

  console.log(`Received: ${entry.received}; total reported: ${entry.totalResults ?? "unknown"}`);
  entry.results.forEach((item, index) => {
    const duration = item.durationMs === null ? "" : ` | ${item.durationMs}ms`;
    const dimensions = [item.maxResolution, item.aspectRatio].filter(Boolean).join(" / ");
    console.log(
      `${index + 1}. ${item.id ?? "no-id"} | ${item.title || item.description || "untitled"}${duration}${dimensions ? ` | ${dimensions}` : ""}`,
    );
    if (item.previewUrls.length) console.log(`   preview: ${item.previewUrls.join(" | ")}`);
    if (item.description && item.description !== item.title) {
      console.log(`   description: ${String(item.description).replaceAll("\n", " ").slice(0, 240)}`);
    }
    if (item.keywords.length) console.log(`   tags: ${item.keywords.join(", ")}`);
  });
}

async function evaluate(mediaType, query) {
  try {
    return await search(mediaType, query);
  } catch (error) {
    if (error instanceof StoryblocksRequestError) {
      return {
        mediaType,
        query,
        ok: false,
        status: error.status,
        category: error.category,
        error: `${error.message}: ${error.response}`,
        results: [],
      };
    }
    return {
      mediaType,
      query,
      ok: false,
      status: null,
      category: "network_or_runtime",
      error: redact(error instanceof Error ? error.message : error),
      results: [],
    };
  }
}

const jobs = [
  ...videoQueries.map((query) => ["videos", query]),
  ...imageQueries.map((query) => ["images", query]),
  ...audioQueries.map((query) => ["audio", query]),
];
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  apiVersion: "v2",
  userId: USER_ID,
  projectId: PROJECT_ID,
  searchOnly: true,
  entries: [],
};

console.log("Storyblocks API v2 search/relevance evaluation");
console.log(`Queries: ${jobs.length}; results per query: 10`);
for (const [mediaType, query] of jobs) {
  const entry = await evaluate(mediaType, query);
  report.entries.push(entry);
  printResult(entry);
}

await mkdir("tmp", { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

const successes = report.entries.filter((entry) => entry.ok).length;
console.log(`\nCompleted: ${successes}/${report.entries.length} searches succeeded.`);
console.log(`Machine-readable report: ${OUTPUT_PATH}`);
if (successes !== report.entries.length) process.exitCode = 1;
