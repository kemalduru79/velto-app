import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const knownBuckets = new Set(["images", "videos", "audio", "dialogue-audio", "movies"]);

function mediaUrls(project) {
  const values = [];
  for (const scene of Array.isArray(project.scenes) ? project.scenes : []) {
    values.push(scene?.image, scene?.imageUrl, scene?.videoUrl, scene?.audioUrl, scene?.dialogueAudioUrl);
    for (const item of Array.isArray(scene?.assetHistory) ? scene.assetHistory : []) values.push(item?.url);
  }
  values.push(project.exported_movie_url, project.youtube_thumbnail?.imageUrl, project.youtube_thumbnail?.sourceImageUrl);
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
}

function firstPartyObject(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const base = new URL(url);
    if (parsed.origin !== base.origin) return null;
    const marker = "/storage/v1/object/public/";
    const offset = parsed.pathname.indexOf(marker);
    if (offset < 0) return null;
    const identity = decodeURIComponent(parsed.pathname.slice(offset + marker.length));
    const slash = identity.indexOf("/");
    if (slash < 1) return null;
    const bucket = identity.slice(0, slash);
    const path = identity.slice(slash + 1);
    return knownBuckets.has(bucket) && path ? { bucket, path, publicUrl: rawUrl } : null;
  } catch {
    return null;
  }
}

async function stat(bucket, storagePath) {
  const slash = storagePath.lastIndexOf("/");
  const directory = slash < 0 ? "" : storagePath.slice(0, slash);
  const name = slash < 0 ? storagePath : storagePath.slice(slash + 1);
  const { data, error } = await supabase.storage.from(bucket).list(directory, { limit: 2, search: name });
  if (error) return { exists: false, sizeBytes: 0, mimeType: null, error: error.message };
  const object = data?.find((item) => item.name === name);
  return { exists: Boolean(object), sizeBytes: Number(object?.metadata?.size || 0), mimeType: object?.metadata?.mimetype || null };
}

const { data: projects, error: projectError } = await supabase
  .from("velto_projects").select("id,owner_user_id,scenes,exported_movie_url,youtube_thumbnail");
if (projectError) throw projectError;
const { data: tracked, error: trackedError } = await supabase
  .from("velto_media_assets").select("bucket,storage_path,size_bytes");
if (trackedError) throw trackedError;

const candidates = new Map();
for (const project of projects || []) {
  for (const candidateUrl of mediaUrls(project)) {
    const object = firstPartyObject(candidateUrl);
    if (!object) continue;
    const identity = `${object.bucket}\u0000${object.path}`;
    const candidate = candidates.get(identity) || { ...object, owners: new Set(), projectIds: new Set() };
    candidate.owners.add(project.owner_user_id);
    candidate.projectIds.add(project.id);
    candidates.set(identity, candidate);
  }
}

let resolvedCount = 0;
let resolvedBytes = 0;
let unresolvedCount = 0;
let unresolvedBytes = 0;
for (const candidate of candidates.values()) {
  const metadata = await stat(candidate.bucket, candidate.path);
  const owner = candidate.owners.size === 1 ? [...candidate.owners][0] : null;
  if (!owner || !metadata.exists) {
    unresolvedCount += 1;
    unresolvedBytes += metadata.sizeBytes;
    console.warn("UNRESOLVED", { bucket: candidate.bucket, path: candidate.path, owners: [...candidate.owners], ...metadata });
    continue;
  }
  resolvedCount += 1;
  resolvedBytes += metadata.sizeBytes;
  if (apply) {
    const extensionKind = metadata.mimeType?.startsWith("image/") ? "image"
      : metadata.mimeType?.startsWith("video/") ? (candidate.bucket === "movies" ? "final_video" : "video")
        : metadata.mimeType?.startsWith("audio/") ? (candidate.bucket === "dialogue-audio" ? "dialogue_audio" : "narration_audio") : "other";
    const { error } = await supabase.from("velto_media_assets").upsert({
      owner_user_id: owner, bucket: candidate.bucket, storage_path: candidate.path,
      public_url: candidate.publicUrl, media_kind: extensionKind, mime_type: metadata.mimeType,
      size_bytes: metadata.sizeBytes, lifecycle_state: "active", metadata: { reconciliation: "project_exact_url_v1" },
    }, { onConflict: "bucket,storage_path", ignoreDuplicates: true });
    if (error) throw error;
  }
}

const trackedBytes = (tracked || []).reduce((sum, row) => sum + Number(row.size_bytes || 0), 0);
console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", existingTrackedObjectCount: tracked?.length || 0,
  existingTrackedBytes: trackedBytes, provableCandidateCount: resolvedCount, provableCandidateBytes: resolvedBytes,
  unresolvedObjectCount: unresolvedCount, unresolvedBytes }, null, 2));
