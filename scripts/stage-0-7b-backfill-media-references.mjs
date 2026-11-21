import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import ts from "typescript";

const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

// Load the exact pure TypeScript helper used by save-project. This avoids a
// second historical parser while keeping the admin command directly runnable.
const extractorSource = fs.readFileSync("lib/persistence/media/projectReferences.ts", "utf8");
const extractorJavaScript = ts.transpileModule(extractorSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { inspectProjectMediaReferences } = await import(
  `data:text/javascript;base64,${Buffer.from(extractorJavaScript).toString("base64")}`
);

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const pageSize = 500;

async function loadAll(table, fields, orderColumn = "id") {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select(fields)
      .order(orderColumn, { ascending: true }).range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

function isFirstPartyPublicUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const base = new URL(url);
    return parsed.origin === base.origin && parsed.pathname.includes("/storage/v1/object/public/");
  } catch {
    return false;
  }
}

const projects = await loadAll(
  "velto_projects",
  "id,owner_user_id,scenes,exported_movie_url,youtube_thumbnail",
);
const assets = await loadAll(
  "velto_media_assets",
  "id,owner_user_id,public_url,lifecycle_state,size_bytes",
);
const storedReferencesBefore = await loadAll(
  "velto_media_asset_references",
  "id,owner_user_id,asset_id,project_id,reference_type,reference_key",
);

const assetsByUrl = new Map();
for (const asset of assets) if (asset.public_url) assetsByUrl.set(asset.public_url, asset);
const resolvedByProject = new Map();
const projectsWithTrackedReferences = new Set();
const trackedAssetIds = new Set();
const conflictProjects = new Set();
const conflicts = [];
let resolvedReferenceCount = 0;
let unresolvedRegisteredReferenceCount = 0;
let externalReferenceCount = 0;
let unknownReferenceCount = 0;

for (const project of projects) {
  const inspection = inspectProjectMediaReferences(project);
  unknownReferenceCount += inspection.unknownReferenceCount;
  const resolved = [];
  for (const reference of inspection.references) {
    const asset = assetsByUrl.get(reference.url);
    if (asset) {
      if (asset.owner_user_id !== project.owner_user_id) {
        conflictProjects.add(project.id);
        conflicts.push({
          projectId: project.id,
          projectOwnerUserId: project.owner_user_id,
          assetId: asset.id,
          assetOwnerUserId: asset.owner_user_id,
          referenceType: reference.referenceType,
          referenceKey: reference.referenceKey,
          url: reference.url,
        });
        continue;
      }
      resolved.push({
        asset_id: asset.id,
        reference_type: reference.referenceType,
        reference_key: reference.referenceKey,
      });
      trackedAssetIds.add(asset.id);
      resolvedReferenceCount += 1;
      continue;
    }
    if (isFirstPartyPublicUrl(reference.url)) unresolvedRegisteredReferenceCount += 1;
    else externalReferenceCount += 1;
  }
  if (resolved.length) projectsWithTrackedReferences.add(project.id);
  resolvedByProject.set(project.id, resolved);
}

const physicalBefore = {
  count: assets.length,
  bytes: assets.reduce((sum, asset) => sum + Number(asset.size_bytes || 0), 0),
};

if (apply && conflicts.length) {
  console.error(JSON.stringify({ error: "OWNER_CONFLICT_BLOCKS_APPLY", conflicts }, null, 2));
} else if (apply) {
  for (const project of projects) {
    const { error } = await supabase.rpc("velto_replace_project_media_references", {
      p_owner_user_id: project.owner_user_id,
      p_project_id: project.id,
      p_references: resolvedByProject.get(project.id) || [],
    });
    if (error) throw new Error(`Reference replacement failed for project ${project.id}: ${error.message}`);
  }
}

const storedReferencesAfter = apply && !conflicts.length
  ? await loadAll("velto_media_asset_references", "id,owner_user_id,asset_id,project_id,reference_type,reference_key")
  : storedReferencesBefore;
const assetsAfter = apply && !conflicts.length
  ? await loadAll("velto_media_assets", "id,owner_user_id,public_url,lifecycle_state,size_bytes")
  : assets;
const physicalAfter = {
  count: assetsAfter.length,
  bytes: assetsAfter.reduce((sum, asset) => sum + Number(asset.size_bytes || 0), 0),
};
if (physicalAfter.count !== physicalBefore.count || physicalAfter.bytes !== physicalBefore.bytes) {
  throw new Error("Physical media inventory changed during reference backfill.");
}

const activeAssetIds = new Set(assetsAfter.filter((asset) => asset.lifecycle_state === "active").map((asset) => asset.id));
const activeReferencedAssetIds = new Set(
  storedReferencesAfter.map((reference) => reference.asset_id).filter((assetId) => activeAssetIds.has(assetId)),
);
const storedProjectIds = new Set(storedReferencesAfter.map((reference) => reference.project_id));
const summary = {
  mode: apply ? "apply" : "dry-run",
  projectCount: projects.length,
  projectsWithTrackedReferences: projectsWithTrackedReferences.size,
  trackedAssetCount: trackedAssetIds.size,
  resolvedReferenceCount,
  unresolvedRegisteredReferenceCount,
  externalReferenceCount,
  unknownReferenceCount,
  projectsWithOwnerConflicts: conflictProjects.size,
  ownerConflictCount: conflicts.length,
  activeTrackedAssetCount: activeAssetIds.size,
  activeTrackedAssetsWithReferences: activeReferencedAssetIds.size,
  activeTrackedAssetsWithoutReferences: activeAssetIds.size - activeReferencedAssetIds.size,
  storedReferenceCount: storedReferencesAfter.length,
  projectsWithStoredReferences: storedProjectIds.size,
  physicalAssetCountBefore: physicalBefore.count,
  physicalAssetCountAfter: physicalAfter.count,
  physicalBytesBefore: physicalBefore.bytes,
  physicalBytesAfter: physicalAfter.bytes,
};

console.log(JSON.stringify(summary, null, 2));
if (apply && conflicts.length) process.exitCode = 2;
