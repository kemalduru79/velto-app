import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const PEXELS_SEARCH_URL = "https://api.pexels.com/videos/search";
const STORYBLOCKS_BASE_URL = "https://api.storyblocks.com";
const STORYBLOCKS_RESOURCE = "/api/v2/videos/search";
const USER_ID = "velto-internal-001";
const PROJECT_ID = "storyblocks-hard-query-benchmark-2026-08";
const JSON_OUTPUT = "tmp/stock-hard-query-benchmark.json";
const HTML_OUTPUT = "tmp/stock-hard-query-benchmark.html";

const pexelsKey = process.env.PEXELS_API_KEY?.trim();
const storyblocksPublicKey = process.env.STORYBLOCKS_PUBLIC_KEY?.trim();
const storyblocksSecretKey = process.env.STORYBLOCKS_SECRET_KEY?.trim();
const missing = [
  !pexelsKey && "PEXELS_API_KEY",
  !storyblocksPublicKey && "STORYBLOCKS_PUBLIC_KEY",
  !storyblocksSecretKey && "STORYBLOCKS_SECRET_KEY",
].filter(Boolean);
if (missing.length) throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);

const queries = [
  "Concorde taking off at Heathrow",
  "British Airways Concorde runway",
  "Air France Concorde airport",
  "Concorde cockpit interior",
  "Concorde passenger cabin 1970s",
  "Rolls-Royce Olympus 593 engine",
  "Concorde aircraft maintenance engineer",
  "1970s Heathrow airport terminal",
  "1970s JFK airport terminal",
  "1970s airport passengers",
  "Concorde landing",
  "supersonic passenger aircraft Concorde",
];

const conceptDefinitions = [
  { name: "concorde", pattern: /\bconcorde\b/i, weight: 5, named: true },
  { name: "heathrow", pattern: /\bheathrow\b/i, weight: 5, named: true },
  { name: "british airways", pattern: /\bbritish\s+airways\b|\bba\s+concorde\b/i, weight: 5, named: true },
  { name: "air france", pattern: /\bair\s+france\b/i, weight: 5, named: true },
  { name: "olympus 593", pattern: /\bolympus(?:\s+593)?\b|\b593\b/i, weight: 5, named: true },
  { name: "rolls-royce", pattern: /\brolls[ -]?royce\b/i, weight: 4, named: true },
  { name: "jfk", pattern: /\bjfk\b|john\s+f\.?\s*kennedy/i, weight: 5, named: true },
  { name: "1970s", pattern: /\b1970s?\b|\bseventies\b|\bvintage\b|\bretro\b|\bhistorical\b/i, weight: 4, named: true },
  { name: "takeoff", pattern: /tak(?:e|ing)\s*off|takeoff|depart(?:ing|ure)|lift(?:ing)?\s*off/i, weight: 2 },
  { name: "runway", pattern: /\brunway\b|\btarmac\b/i, weight: 2 },
  { name: "airport", pattern: /\bairport\b|\bairfield\b/i, weight: 1 },
  { name: "cockpit", pattern: /\bcockpit\b|flight\s+deck/i, weight: 3 },
  { name: "interior", pattern: /\binterior\b|\binside\b/i, weight: 2 },
  { name: "passenger", pattern: /\bpassenger(?:s)?\b|\btravell?er(?:s)?\b/i, weight: 2 },
  { name: "cabin", pattern: /\bcabin\b|passenger\s+(?:area|compartment)/i, weight: 3 },
  { name: "engine", pattern: /\bengine\b|\bturbine\b|\bjet\s+motor\b/i, weight: 2 },
  { name: "maintenance", pattern: /maintenan(?:ce|t)|mechanic|repair|inspect(?:ion|ing)?/i, weight: 3 },
  { name: "engineer", pattern: /\bengineer\b|\btechnician\b|\bmechanic\b/i, weight: 2 },
  { name: "terminal", pattern: /\bterminal\b|departure\s+hall|arrival\s+hall/i, weight: 3 },
  { name: "landing", pattern: /\bland(?:ing|ed)?\b|touch(?:ing)?\s+down|touchdown|final\s+approach/i, weight: 3 },
  { name: "supersonic", pattern: /\bsupersonic\b|faster\s+than\s+sound/i, weight: 4 },
  { name: "aircraft", pattern: /\baircraft\b|\bairplane\b|\baeroplane\b|\bplane\b|\bjet\b/i, weight: 1 },
];

function queryConcepts(query) {
  return conceptDefinitions.filter((concept) => concept.pattern.test(query));
}

function scoreMetadata(query, text) {
  const concepts = queryConcepts(query);
  const matched = concepts.filter((concept) => concept.pattern.test(text));
  const named = concepts.filter((concept) => concept.named);
  const matchedNamed = named.filter((concept) => concept.pattern.test(text));
  const totalWeight = concepts.reduce((sum, concept) => sum + concept.weight, 0) || 1;
  const matchedWeight = matched.reduce((sum, concept) => sum + concept.weight, 0);
  const ratio = matchedWeight / totalWeight;
  const allNamedMatched = named.length > 0 && matchedNamed.length === named.length;
  let score = 0;
  if (allNamedMatched && ratio >= 0.7) score = 3;
  else if (allNamedMatched && ratio >= 0.4) score = 2;
  else if (!named.length && ratio >= 0.75) score = 3;
  else if (!named.length && ratio >= 0.45) score = 2;
  else if (ratio >= 0.2 || matchedNamed.length > 0) score = 1;
  return {
    metadataRelevanceScore: score,
    matchedConcepts: matched.map((concept) => concept.name),
    exactNamedEntityMatch: allNamedMatched,
  };
}

function first(object, keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function list(value) {
  if (Array.isArray(value)) return value.map((item) => typeof item === "object" ? first(item, ["name", "title", "value"]) : item).filter(Boolean).map(String);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function safePreviewUrl(value) {
  if (typeof value !== "string" || !value.startsWith("https://")) return null;
  const url = new URL(value);
  for (const key of [...url.searchParams.keys()]) {
    if (["apikey", "hmac", "expires", "publickey"].includes(key.toLowerCase())) url.searchParams.delete(key);
  }
  return url.toString();
}

function bestStoryblocksPreview(item) {
  const previews = Object.values(first(item, ["preview_urls", "previewUrls"]) || {}).map(safePreviewUrl).filter(Boolean);
  return previews.find((url) => /(?:resolution=720p|__P720\.mp4)/i.test(url)) || previews.find((url) => /\.mp4(?:\?|$)/i.test(url)) || safePreviewUrl(first(item, ["preview_url", "thumbnail_url"]));
}

function bestPexelsPreview(item) {
  const files = Array.isArray(item.video_files) ? item.video_files : [];
  const mp4 = files.filter((file) => file?.file_type === "video/mp4" && typeof file.link === "string" && file.link.startsWith("https://"));
  const ranked = mp4.sort((a, b) => {
    const aHeight = Number(a.height) || 0;
    const bHeight = Number(b.height) || 0;
    return Math.abs(aHeight - 720) - Math.abs(bHeight - 720);
  });
  return safePreviewUrl(ranked[0]?.link) || safePreviewUrl(item.image);
}

function booleanOrNull(value) {
  return typeof value === "boolean" ? value : null;
}

function rightsClassification(item, metadataText) {
  const isEditorial = booleanOrNull(first(item, ["isEditorial", "is_editorial"]));
  const hasTalentReleased = booleanOrNull(first(item, ["hasTalentReleased", "has_talent_released"]));
  const hasPropertyReleased = booleanOrNull(first(item, ["hasPropertyReleased", "has_property_released"]));
  const recognizablePeopleOrProperty = /passenger|people|person|man|woman|engineer|mechanic|terminal|airport|cockpit|cabin|british airways|air france|heathrow|jfk/i.test(metadataText);
  let classification = "YELLOW";
  if (isEditorial === true) classification = "RED";
  else if (isEditorial === false && (!recognizablePeopleOrProperty || hasTalentReleased === true || hasPropertyReleased === true)) classification = "GREEN";
  return { classification, isEditorial, hasTalentReleased, hasPropertyReleased };
}

function summarize(results) {
  return {
    resultsReturned: results.length,
    usefulResults: results.filter((result) => result.metadataRelevanceScore >= 2).length,
    strongResults: results.filter((result) => result.metadataRelevanceScore === 3).length,
    averageMetadataRelevance: results.length ? Number((results.reduce((sum, result) => sum + result.metadataRelevanceScore, 0) / results.length).toFixed(3)) : 0,
    exactNamedEntityMatches: results.filter((result) => result.exactNamedEntityMatch).length,
  };
}

function redact(value, signature = "") {
  return String(value)
    .replaceAll(pexelsKey, "[REDACTED_PEXELS_KEY]")
    .replaceAll(storyblocksPublicKey, "[REDACTED_STORYBLOCKS_PUBLIC_KEY]")
    .replaceAll(storyblocksSecretKey, "[REDACTED_STORYBLOCKS_SECRET_KEY]")
    .replaceAll(signature, signature ? "[REDACTED_HMAC]" : "");
}

async function responseJson(response, provider, signature = "") {
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const category = response.status === 401 || response.status === 403 ? "authentication" : response.status === 429 ? "rate_limit" : "api";
    throw new Error(`${provider} ${category} error (${response.status}): ${redact(typeof body === "string" ? body : JSON.stringify(body), signature).slice(0, 1000)}`);
  }
  return body;
}

async function searchPexels(query) {
  const params = new URLSearchParams({ query, per_page: "10", page: "1", orientation: "landscape" });
  const response = await fetch(`${PEXELS_SEARCH_URL}?${params}`, {
    headers: { Authorization: pexelsKey, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await responseJson(response, "Pexels");
  const rows = Array.isArray(body?.videos) ? body.videos.slice(0, 10) : [];
  return rows.map((item, index) => {
    const pageUrl = typeof item.url === "string" ? item.url : null;
    const urlMetadata = pageUrl ? new URL(pageUrl).pathname.replaceAll(/[-_/]/g, " ") : "";
    const title = first(item, ["title", "name"]);
    const description = first(item, ["description", "alt"]);
    const keywords = list(first(item, ["keywords", "tags"]));
    const metadataText = [title, description, keywords.join(" "), urlMetadata].filter(Boolean).join(" ");
    const relevance = scoreMetadata(query, metadataText);
    return {
      provider: "pexels",
      rank: index + 1,
      id: String(item.id ?? ""),
      title: title || description || (urlMetadata.trim() || "Untitled Pexels result"),
      description,
      keywords,
      previewUrl: bestPexelsPreview(item),
      thumbnailUrl: safePreviewUrl(item.image),
      durationMs: typeof item.duration === "number" ? item.duration * 1000 : null,
      maxResolution: item.width && item.height ? `${item.width}x${item.height}` : null,
      aspectRatio: item.width && item.height ? Number((item.width / item.height).toFixed(5)) : null,
      orientation: item.width > item.height ? "horizontal" : item.width < item.height ? "vertical" : "square",
      providerLicense: "Pexels License",
      generalCommercialUse: true,
      assetReleaseMetadata: "not_available_via_api",
      rightsCertainty: "requires_context_review",
      ...relevance,
    };
  });
}

async function searchStoryblocks(query) {
  assert(!STORYBLOCKS_RESOURCE.includes("download"));
  const expires = String(Math.floor(Date.now() / 1000) + 3600);
  const signature = createHmac("sha256", `${storyblocksSecretKey}${expires}`).update(STORYBLOCKS_RESOURCE).digest("hex");
  const params = new URLSearchParams({
    APIKEY: storyblocksPublicKey,
    EXPIRES: expires,
    HMAC: signature,
    user_id: USER_ID,
    project_id: PROJECT_ID,
    keywords: query,
    results_per_page: "10",
    page: "1",
    sort_by: "most_relevant",
    safe_search: "true",
    orientation: "horizontal",
    extended: "isEditorial,hasTalentReleased,hasPropertyReleased,description,keywords,maxResolution,aspectRatio,durationMs,dateAdded",
  });
  const response = await fetch(`${STORYBLOCKS_BASE_URL}${STORYBLOCKS_RESOURCE}?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await responseJson(response, "Storyblocks", signature);
  const rows = Array.isArray(body?.results) ? body.results.slice(0, 10) : [];
  return rows.map((item, index) => {
    const title = first(item, ["title", "name"]);
    const description = first(item, ["description", "caption"]);
    const keywords = list(first(item, ["keywords", "tags"]));
    const metadataText = [title, description, keywords.join(" ")].filter(Boolean).join(" ");
    const relevance = scoreMetadata(query, metadataText);
    return {
      provider: "storyblocks",
      rank: index + 1,
      id: String(first(item, ["id", "stock_item_id", "stockItemId"]) ?? ""),
      title: title || description || "Untitled Storyblocks result",
      description,
      keywords,
      previewUrl: bestStoryblocksPreview(item),
      thumbnailUrl: safePreviewUrl(first(item, ["thumbnail_url", "thumbnailUrl"])),
      durationMs: typeof first(item, ["durationMs", "duration_ms"]) === "number" ? first(item, ["durationMs", "duration_ms"]) : typeof item.duration === "number" ? item.duration * 1000 : null,
      maxResolution: first(item, ["maxResolution", "max_resolution"]),
      aspectRatio: first(item, ["aspectRatio", "aspect_ratio"]),
      orientation: first(item, ["orientation"]),
      dateAdded: first(item, ["dateAdded", "date_added"]),
      rights: rightsClassification(item, metadataText),
      ...relevance,
    };
  });
}

function storyblocksRightsSummary(results) {
  const count = (predicate) => results.filter(predicate).length;
  return {
    green: count((result) => result.rights.classification === "GREEN"),
    yellow: count((result) => result.rights.classification === "YELLOW"),
    red: count((result) => result.rights.classification === "RED"),
    explicitEditorialStatus: count((result) => result.rights.isEditorial !== null),
    explicitTalentReleaseMetadata: count((result) => result.rights.hasTalentReleased !== null),
    explicitPropertyReleaseMetadata: count((result) => result.rights.hasPropertyReleased !== null),
  };
}

function decisionsFor(pexels, storyblocks, storyRights) {
  const decisions = [];
  const p = pexels.summary;
  const s = storyblocks.summary;
  const storyAddsExact = s.exactNamedEntityMatches > p.exactNamedEntityMatches || s.strongResults >= p.strongResults + 2;
  const storyFillsGap = p.usefulResults < 3 && s.usefulResults >= 2;
  const explicitRights = storyRights.explicitEditorialStatus + storyRights.explicitTalentReleaseMetadata + storyRights.explicitPropertyReleaseMetadata;
  const comparableUseful = s.usefulResults >= Math.max(1, p.usefulResults - 1);
  if ((p.usefulResults < 2 && s.usefulResults < 2) || (p.exactNamedEntityMatches === 0 && s.exactNamedEntityMatches === 0 && p.strongResults === 0 && s.strongResults === 0)) {
    decisions.push("BOTH_WEAK_USE_AI_OR_SPECIALIST");
  } else {
    if (storyAddsExact || storyFillsGap || (explicitRights > 0 && comparableUseful)) decisions.push("STORYBLOCKS_ADDS_VALUE");
    if (p.usefulResults >= 3 && !storyAddsExact) decisions.push("PEXELS_SUFFICIENT");
  }
  const usefulStoryResults = storyblocks.results.filter((result) => result.metadataRelevanceScore >= 2);
  if ((p.usefulResults || s.usefulResults) && (usefulStoryResults.some((result) => result.rights.classification !== "GREEN") || (s.usefulResults === 0 && p.usefulResults > 0))) {
    decisions.push("RIGHTS_REVIEW_REQUIRED");
  }
  if (!decisions.length) decisions.push("CONDITIONAL");
  return [...new Set(decisions)];
}

const queryReports = [];
for (const query of queries) {
  console.log(`\n${query}`);
  const providers = {};
  for (const [provider, search] of [["pexels", searchPexels], ["storyblocks", searchStoryblocks]]) {
    try {
      const results = await search(query);
      providers[provider] = { ok: true, results, summary: summarize(results) };
      console.log(`  ${provider}: ${results.length} results, ${providers[provider].summary.usefulResults} useful, ${providers[provider].summary.exactNamedEntityMatches} exact`);
    } catch (error) {
      providers[provider] = { ok: false, error: redact(error instanceof Error ? error.message : error), results: [], summary: summarize([]) };
      console.log(`  ${provider}: FAILED ${providers[provider].error}`);
    }
  }
  const rights = storyblocksRightsSummary(providers.storyblocks.results);
  queryReports.push({
    query,
    pexels: providers.pexels,
    storyblocks: { ...providers.storyblocks, rightsSummary: rights },
    decisions: decisionsFor(providers.pexels, providers.storyblocks, rights),
  });
}

function aggregate(provider) {
  const results = queryReports.flatMap((entry) => entry[provider].results);
  return summarize(results);
}

const storyblocksRights = storyblocksRightsSummary(queryReports.flatMap((entry) => entry.storyblocks.results));
const report = {
  generatedAt: new Date().toISOString(),
  benchmark: "Storyblocks vs Pexels hard-query and rights benchmark",
  methodology: {
    relevance: "Deterministic metadata-only concept matching; not a visual-quality score.",
    rights: "Velto operational safety heuristic; not legal advice or a legal-clearance determination.",
    downloadsUsed: false,
  },
  providerAttempts: {
    pexels: { attempted: 12, succeeded: queryReports.filter((entry) => entry.pexels.ok).length, failed: queryReports.filter((entry) => !entry.pexels.ok).length },
    storyblocks: { attempted: 12, succeeded: queryReports.filter((entry) => entry.storyblocks.ok).length, failed: queryReports.filter((entry) => !entry.storyblocks.ok).length },
  },
  aggregate: {
    pexels: aggregate("pexels"),
    storyblocks: { ...aggregate("storyblocks"), rights: storyblocksRights },
  },
  storyblocksIncrementalValueRate: Number((queryReports.filter((entry) => entry.decisions.includes("STORYBLOCKS_ADDS_VALUE")).length / 12).toFixed(4)),
  queries: queryReports,
};

const escapeHtml = (value) => String(value ?? "-").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const resultCard = (result, provider) => {
  const media = result.previewUrl ? `<video controls preload="metadata" playsinline src="${escapeHtml(result.previewUrl)}"></video>` : result.thumbnailUrl ? `<img loading="lazy" src="${escapeHtml(result.thumbnailUrl)}" alt="">` : `<div class="missing">Preview unavailable</div>`;
  const rights = provider === "storyblocks" ? `<p><strong class="${result.rights.classification.toLowerCase()}">${result.rights.classification}</strong> · editorial: ${result.rights.isEditorial ?? "unknown"} · talent release: ${result.rights.hasTalentReleased ?? "unknown"} · property release: ${result.rights.hasPropertyReleased ?? "unknown"}</p>` : `<p>Pexels License · commercial use generally allowed · per-asset release metadata unavailable · context review required</p>`;
  return `<article>${media}<div class="body"><h4>#${result.rank} ${escapeHtml(result.title)}</h4><p>ID: ${escapeHtml(result.id)} · Metadata Relevance Score: <strong>${result.metadataRelevanceScore}</strong> · ${result.durationMs ? `${(result.durationMs / 1000).toFixed(1)}s` : "duration -"}</p>${rights}</div></article>`;
};
const summaryBox = (name, aggregateSummary, rights = null) => `<div class="summary"><h2>${name}</h2><p>Total results: <strong>${aggregateSummary.resultsReturned}</strong></p><p>Useful results: <strong>${aggregateSummary.usefulResults}</strong></p><p>Exact matches: <strong>${aggregateSummary.exactNamedEntityMatches}</strong></p><p>Average metadata relevance: <strong>${aggregateSummary.averageMetadataRelevance}</strong></p>${rights ? `<p>Rights GREEN/YELLOW/RED: <strong>${rights.green}/${rights.yellow}/${rights.red}</strong></p>` : ""}</div>`;
const decisionList = (decision) => queryReports.filter((entry) => entry.decisions.includes(decision)).map((entry) => entry.query);
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Storyblocks vs Pexels Hard Query Benchmark</title><style>
body{margin:0;background:#0b1020;color:#eef2ff;font-family:Inter,system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:28px}h1,h2,h3,h4,p{margin-top:0}.summaries,.providers{display:grid;grid-template-columns:1fr 1fr;gap:16px}.summary,article,.decision{border:1px solid #303a59;border-radius:14px;background:#151c31;padding:16px}.query{margin:42px 0}.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}article{padding:0;overflow:hidden}article video,article img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#050810}.body{padding:13px;font-size:13px}.green{color:#50dc9c}.yellow{color:#ffd166}.red{color:#ff6b7a}.decisions{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:20px 0}.muted{color:#9da8c7}.missing{padding:60px 15px;text-align:center;background:#050810}@media(max-width:900px){.summaries,.providers,.decisions{grid-template-columns:1fr}.cards{grid-template-columns:1fr}}
</style></head><body><main><h1>Storyblocks vs Pexels Hard Query + Rights Benchmark</h1><p class="muted">Metadata relevance is deterministic and metadata-only, not a visual-quality score. Rights classifications are operational heuristics, not legal advice.</p><div class="summaries">${summaryBox("PEXELS", report.aggregate.pexels)}${summaryBox("STORYBLOCKS", report.aggregate.storyblocks, report.aggregate.storyblocks.rights)}</div><h2>Storyblocks incremental value rate: ${(report.storyblocksIncrementalValueRate * 100).toFixed(1)}%</h2><div class="decisions">${["PEXELS_SUFFICIENT", "STORYBLOCKS_ADDS_VALUE", "BOTH_WEAK_USE_AI_OR_SPECIALIST", "RIGHTS_REVIEW_REQUIRED"].map((decision) => `<div class="decision"><h3>${decision}</h3><p>${decisionList(decision).map(escapeHtml).join("<br>") || "None"}</p></div>`).join("")}</div>${queryReports.map((entry) => `<section class="query"><h2>${escapeHtml(entry.query)}</h2><p>Decision: <strong>${entry.decisions.join(" + ")}</strong></p><div class="providers"><div><h3>PEXELS — ${entry.pexels.summary.usefulResults} useful / ${entry.pexels.summary.exactNamedEntityMatches} exact</h3><div class="cards">${entry.pexels.results.slice(0, 3).map((result) => resultCard(result, "pexels")).join("") || `<div class="missing">No results</div>`}</div></div><div><h3>STORYBLOCKS — ${entry.storyblocks.summary.usefulResults} useful / ${entry.storyblocks.summary.exactNamedEntityMatches} exact</h3><div class="cards">${entry.storyblocks.results.slice(0, 3).map((result) => resultCard(result, "storyblocks")).join("") || `<div class="missing">No results</div>`}</div></div></div></section>`).join("")}</main></body></html>`;

const serialized = JSON.stringify(report, null, 2);
for (const credential of [pexelsKey, storyblocksPublicKey, storyblocksSecretKey]) {
  assert(!serialized.includes(credential), "Credential leaked into JSON report");
  assert(!html.includes(credential), "Credential leaked into HTML report");
}
assert(!/\/stock-item\/download\//i.test(serialized + html));
assert(!/[?&](?:APIKEY|HMAC|EXPIRES|publicKey)=/i.test(serialized + html));

await mkdir("tmp", { recursive: true });
await writeFile(JSON_OUTPUT, `${serialized}\n`, "utf8");
await writeFile(HTML_OUTPUT, html, "utf8");
console.log(`\nGenerated ${JSON_OUTPUT}`);
console.log(`Generated ${HTML_OUTPUT}`);
