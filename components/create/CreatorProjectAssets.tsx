"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  canonicalCreatorMediaUrl,
  deriveCreatorProjectAssets,
  rankCreatorProjectAssetsForScene,
  type CreatorProjectAssetScene,
} from "@/lib/creator/projectAssets";

type CreatorProjectAssetsProps = {
  scenes: readonly CreatorProjectAssetScene[];
  targetCreatorSceneId: string;
  disabled?: boolean;
  language: "en" | "tr";
  onUseImage: (url: string, sourceCreatorSceneId: string) => void;
  projectId: string;
  getAccessToken: () => Promise<string>;
  onHistoryRemoved: (url: string) => void;
};

type CleanupAsset = {
  id: string;
  publicUrl: string | null;
  mediaKind: "image" | "video" | "final_video";
  sizeBytes: number;
  lifecycleState: "active" | "trashed";
  cleanupState: "IN_USE" | "HISTORY_ONLY" | "UNREFERENCED" | "TRASHED";
  referenceCount: number;
  blockingReferenceCount: number;
  historyReferenceCount: number;
  referenceSummary: Array<{ projectId: string; referenceType: string; referenceKey: string }>;
  trashedAt: string | null;
  purgePending: boolean;
  permanentDeleteEnabled: boolean;
  permanentDeleteEligible: boolean;
  purgeEligibleAt: string | null;
  purgeDaysRemaining: number | null;
};

type StorageStatus = {
  configured: boolean;
  enforcementEnabled: boolean;
  usedBytes: number;
  activeBytes: number;
  trashedBytes: number;
  additionalEntitlementBytes: number;
  effectiveLimitBytes: number | null;
  limitBytes: number | null;
  usageRatio: number | null;
  state: "NORMAL" | "APPROACHING" | "CRITICAL" | "FULL" | null;
  decision: "UNCONFIGURED" | "ALLOWED" | "FULL_BUT_NOT_ENFORCED" | "BLOCKED_FULL";
};

export default function CreatorProjectAssets({
  scenes,
  targetCreatorSceneId,
  disabled = false,
  language,
  onUseImage,
  projectId,
  getAccessToken,
  onHistoryRemoved,
}: CreatorProjectAssetsProps) {
  const [cleanupAssets, setCleanupAssets] = useState<CleanupAsset[]>([]);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupError, setCleanupError] = useState("");
  const [pendingAssetId, setPendingAssetId] = useState("");
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [purgeConfirmAssetId, setPurgeConfirmAssetId] = useState("");
  const loadCleanupAssets = useCallback(async () => {
    setCleanupLoading(true);
    setCleanupError("");
    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/media-assets", { headers: { Authorization: `Bearer ${accessToken}` } });
      const payload = await response.json() as { assets?: CleanupAsset[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Media inventory is unavailable.");
      setCleanupAssets(payload.assets || []);
      const storageResponse = await fetch("/api/storage-usage", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const storagePayload = await storageResponse.json() as { storage?: StorageStatus };
      if (storageResponse.ok) setStorageStatus(storagePayload.storage || null);
    } catch (error) {
      setCleanupError(error instanceof Error ? error.message : "Media inventory is unavailable.");
    } finally {
      setCleanupLoading(false);
    }
  }, [getAccessToken]);
  // The inventory is external API state and must be synchronized when auth changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadCleanupAssets(); }, [loadCleanupAssets]);
  const assets = useMemo(() => deriveCreatorProjectAssets(scenes), [scenes]);
  const recommendations = useMemo(
    () => rankCreatorProjectAssetsForScene({ scenes, targetCreatorSceneId }),
    [scenes, targetCreatorSceneId],
  );
  const targetScene = scenes.find((scene) => scene.creatorSceneId === targetCreatorSceneId);
  const targetImageKey = targetScene?.image
    ? canonicalCreatorMediaUrl(targetScene.image)
    : "";
  const images = assets.filter((asset) =>
    asset.kind === "image" &&
    !(asset.sourceCreatorSceneId === targetCreatorSceneId &&
      asset.version === "current" &&
      canonicalCreatorMediaUrl(asset.url) === targetImageKey),
  );
  const videos = assets.filter((asset) => asset.kind === "video");
  const hasAssets = images.length > 0 || videos.length > 0;
  const sceneLabel = (sceneNumber: number) =>
    `${language === "en" ? "From Scene" : "Sahne"} ${String(sceneNumber).padStart(2, "0")}`;
  const versionLabel = (version: "current" | "history") =>
    version === "current"
      ? language === "en" ? "Current asset" : "Geçerli varlık"
      : language === "en" ? "Previous asset" : "Önceki varlık";
  const unusedAssets = cleanupAssets.filter((asset) => asset.cleanupState === "UNREFERENCED" && asset.lifecycleState === "active");
  const trashedAssets = cleanupAssets.filter((asset) => asset.cleanupState === "TRASHED");
  const activeCleanupAssets = cleanupAssets.filter((asset) => asset.lifecycleState === "active" && asset.cleanupState !== "UNREFERENCED");
  const formatBytes = (bytes: number) => bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1_000))} KB`;
  const usageLabel = (asset: CleanupAsset) => {
    if (asset.referenceCount > 1) return language === "en" ? `Used in ${asset.referenceCount} places` : `${asset.referenceCount} yerde kullanılıyor`;
    const type = asset.referenceSummary[0]?.referenceType;
    if (type === "final_video") return language === "en" ? "Used as final video" : "Final video olarak kullanılıyor";
    if (type === "thumbnail") return language === "en" ? "Used as thumbnail" : "Küçük resim olarak kullanılıyor";
    if (type?.startsWith("scene_")) return language === "en" ? "Used in a scene" : "Bir sahnede kullanılıyor";
    return language === "en" ? "Used in project history" : "Proje geçmişinde kullanılıyor";
  };
  const mutateAsset = async (asset: CleanupAsset, action: "trash" | "restore" | "purge") => {
    if (action === "trash" && asset.cleanupState === "HISTORY_ONLY" && !window.confirm(
      language === "en" ? "Remove this media from project history and move it to Trash?" : "Bu medyayı proje geçmişinden çıkarıp Çöp Kutusuna taşımak istiyor musunuz?",
    )) return;
    setPendingAssetId(asset.id);
    setCleanupError("");
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`/api/media-assets/${encodeURIComponent(asset.id)}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: action === "purge"
          ? JSON.stringify({ confirmPermanentDeletion: true })
          : action === "trash" && asset.cleanupState === "HISTORY_ONLY"
            ? JSON.stringify({ projectId })
            : "{}",
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Media lifecycle could not be changed.");
      if (action === "trash" && asset.cleanupState === "HISTORY_ONLY" && asset.publicUrl) onHistoryRemoved(asset.publicUrl);
      if (action === "purge") setPurgeConfirmAssetId("");
      await loadCleanupAssets();
    } catch (error) {
      setCleanupError(error instanceof Error ? error.message : "Media lifecycle could not be changed.");
    } finally {
      setPendingAssetId("");
    }
  };

  return (
    <details className="creatorlab-p2c-editor-disclosure" data-creator-project-assets="true">
      <summary>
        <span>{language === "en" ? "Use existing media" : "Mevcut medyayı kullan"}</span>
        <small>
          {recommendations.length > 0 && `${recommendations.length} ${language === "en" ? "matches" : "eşleşme"} · `}
          {language === "en" ? "Project Assets" : "Proje Varlıkları"} · {assets.length}
        </small>
      </summary>
      <div className="creatorlab-p2c-editor-disclosure-body">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-950">
            {language === "en" ? "Project Assets" : "Proje Varlıkları"}
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {language === "en"
              ? "Reuse assets already available in this project."
              : "Bu projede bulunan varlıkları yeniden kullanın."}
          </p>
          <p className="mt-1 text-xs font-medium text-emerald-700">
            {language === "en" ? "No generation credits used" : "Üretim kredisi kullanılmaz"}
          </p>
        </div>

        {storageStatus && (
          <section className={`mb-4 rounded-xl border p-3 ${storageStatus.state === "FULL" || storageStatus.state === "CRITICAL" ? "border-amber-300 bg-amber-50" : storageStatus.state === "APPROACHING" ? "border-blue-200 bg-blue-50/50" : "border-slate-200 bg-white"}`} data-storage-quota-state={storageStatus.state || "UNCONFIGURED"}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <strong className="text-slate-800">{language === "en" ? "Used storage" : "Kullanılan depolama"}</strong>
              <span className="text-slate-600">{formatBytes(storageStatus.usedBytes)}{storageStatus.configured && storageStatus.limitBytes ? ` ${language === "en" ? "of" : "/"} ${formatBytes(storageStatus.limitBytes)}` : ""}</span>
            </div>
            {storageStatus.configured && storageStatus.usageRatio !== null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(storageStatus.usageRatio * 100))}><span className={`block h-full rounded-full ${storageStatus.state === "FULL" || storageStatus.state === "CRITICAL" ? "bg-amber-600" : "bg-blue-600"}`} style={{ width: `${Math.min(100, storageStatus.usageRatio * 100)}%` }} /></div>}
            {storageStatus.configured && storageStatus.additionalEntitlementBytes > 0 && <p className="mt-2 text-[11px] text-slate-500">{language === "en" ? `Includes ${formatBytes(storageStatus.additionalEntitlementBytes)} additional storage.` : `${formatBytes(storageStatus.additionalEntitlementBytes)} ek depolama dahil.`}</p>}
            {storageStatus.trashedBytes > 0 && <p className="mt-2 text-[11px] text-slate-500">{language === "en" ? `${formatBytes(storageStatus.trashedBytes)} in Trash still uses storage.` : `Çöp Kutusundaki ${formatBytes(storageStatus.trashedBytes)} hâlâ depolama kullanıyor.`}</p>}
            {storageStatus.decision === "BLOCKED_FULL" && <div className="mt-3 rounded-lg bg-amber-100 p-3 text-xs text-amber-950"><p>{language === "en" ? "Storage is full. New image and video generation is temporarily unavailable." : "Depolama alanı dolu. Yeni görsel ve video üretimi geçici olarak kullanılamıyor."}</p><button type="button" onClick={() => document.getElementById("creator-media-management")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="mt-2 rounded-lg border border-amber-400 px-3 py-2 font-semibold">{language === "en" ? "Manage storage" : "Depolamayı yönet"}</button></div>}
          </section>
        )}

        {!hasAssets && (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm leading-6 text-slate-600">
            {language === "en"
              ? "No reusable project assets yet. Create or import media for another scene first."
              : "Henüz yeniden kullanılabilir proje varlığı yok. Önce başka bir sahne için medya oluşturun veya ekleyin."}
          </p>
        )}

        {hasAssets && <section className="mb-5" aria-labelledby="creator-project-recommendations-title" data-creator-smart-match="local">
          <h4 id="creator-project-recommendations-title" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
            {language === "en" ? "Recommended for this scene" : "Bu sahne için önerilenler"}
          </h4>
          {recommendations.length > 0 ? (
            <ul className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recommendations.map((asset) => (
                <li key={`recommended:${asset.id}`} data-match-reason={asset.matchReason} className="min-w-0 overflow-hidden rounded-xl border border-blue-200 bg-blue-50/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.url} alt={`${language === "en" ? "Possible match" : "Olası eşleşme"} · ${sceneLabel(asset.sourceSceneNumber)}`} className="aspect-video w-full bg-slate-100 object-cover" loading="lazy" />
                  <div className="p-3">
                    <strong className="block text-xs text-slate-800">{sceneLabel(asset.sourceSceneNumber)}</strong>
                    <span className="mt-1 block text-[11px] text-blue-700">
                      {asset.matchReason === "shared_topic"
                        ? language === "en" ? "Shared topic" : "Ortak konu"
                        : language === "en" ? "Related scene context" : "İlgili sahne bağlamı"}
                    </span>
                    <button type="button" disabled={disabled} onClick={() => onUseImage(asset.url, asset.sourceCreatorSceneId)} className="mt-3 min-h-11 w-full rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
                      {language === "en" ? "Use image" : "Görseli kullan"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {language === "en" ? "No strong project match found." : "Güçlü bir proje eşleşmesi bulunamadı."}
            </p>
          )}
        </section>}

        {hasAssets && (
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
            {language === "en" ? "All project assets" : "Tüm proje varlıkları"}
          </h4>
        )}

        {images.length > 0 && (
          <section aria-labelledby="creator-project-images-title">
            <h4 id="creator-project-images-title" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
              {language === "en" ? "Images" : "Görseller"}
            </h4>
            <ul className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((asset) => {
                const isNoOp = canonicalCreatorMediaUrl(asset.url) === targetImageKey;
                return (
                  <li key={asset.id} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.url} alt={`${sceneLabel(asset.sourceSceneNumber)} · ${versionLabel(asset.version)}`} className="aspect-video w-full bg-slate-100 object-cover" loading="lazy" />
                    <div className="p-3">
                      <strong className="block text-xs text-slate-800">{sceneLabel(asset.sourceSceneNumber)}</strong>
                      <span className="mt-1 block truncate text-[11px] text-slate-500">{versionLabel(asset.version)}</span>
                      {!isNoOp && (
                        <button type="button" disabled={disabled} onClick={() => onUseImage(asset.url, asset.sourceCreatorSceneId)} className="mt-3 min-h-11 w-full rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
                          {language === "en" ? "Use image" : "Görseli kullan"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {videos.length > 0 && (
          <section className={images.length > 0 ? "mt-5" : ""} aria-labelledby="creator-project-videos-title" data-cross-scene-video-reuse="deferred">
            <h4 id="creator-project-videos-title" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Video</h4>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {language === "en" ? "Videos remain available in their original scene." : "Videolar özgün sahnelerinde kullanılabilir."}
            </p>
            <ul className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((asset) => (
                <li key={asset.id} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <video src={asset.url} preload="metadata" controls aria-label={`${sceneLabel(asset.sourceSceneNumber)} · ${versionLabel(asset.version)}`} className="aspect-video w-full bg-slate-950 object-contain" />
                  <div className="p-3 text-xs"><strong>{sceneLabel(asset.sourceSceneNumber)}</strong><span className="ml-2 text-slate-500">{versionLabel(asset.version)}</span></div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(cleanupLoading || cleanupError || cleanupAssets.length > 0) && (
          <section id="creator-media-management" className="mt-5 scroll-mt-6 border-t border-slate-200 pt-4" data-media-cleanup-inventory="true">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                  {language === "en" ? "Available media" : "Kullanılabilir medya"}
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  {language === "en" ? "Stored media not currently placed in a project." : "Şu anda bir projede kullanılmayan kayıtlı medya."}
                </p>
              </div>
              <button type="button" onClick={() => void loadCleanupAssets()} disabled={cleanupLoading} className="text-xs font-semibold text-blue-700 disabled:opacity-40">
                {cleanupLoading ? "…" : language === "en" ? "Refresh" : "Yenile"}
              </button>
            </div>
            {cleanupError && <p role="alert" className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{cleanupError}</p>}
            {unusedAssets.length > 0 && (
              <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {unusedAssets.map((asset) => <li key={asset.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {asset.publicUrl && asset.mediaKind === "image" ? <img src={asset.publicUrl} alt="" className="aspect-video w-full bg-slate-100 object-cover" loading="lazy" /> : asset.publicUrl ? <video src={asset.publicUrl} preload="metadata" className="aspect-video w-full bg-slate-950 object-contain" /> : null}
                  <div className="p-3 text-xs">
                    <span className="text-slate-500">{asset.mediaKind === "image" ? language === "en" ? "Image" : "Görsel" : "Video"} · {formatBytes(asset.sizeBytes)}</span>
                    {asset.mediaKind === "image" && asset.publicUrl && <button type="button" disabled={disabled} onClick={() => onUseImage(asset.publicUrl!, "available-media")} className="mt-3 min-h-11 w-full rounded-lg bg-blue-700 px-3 py-2 font-semibold text-white disabled:opacity-40">{language === "en" ? "Use image" : "Görseli kullan"}</button>}
                    <button type="button" disabled={pendingAssetId === asset.id} onClick={() => void mutateAsset(asset, "trash")} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-600 disabled:opacity-40">{language === "en" ? "Move to Trash" : "Çöp Kutusuna Taşı"}</button>
                  </div>
                </li>)}
              </ul>
            )}

            {activeCleanupAssets.length > 0 && <details className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-700">{language === "en" ? "Cleanup status" : "Temizlik durumu"} · {activeCleanupAssets.length}</summary>
              <ul className="mt-3 space-y-2">
                {activeCleanupAssets.map((asset) => {
                  const historyProjects = new Set(asset.referenceSummary.map((reference) => reference.projectId));
                  const canCleanHistory = asset.cleanupState === "HISTORY_ONLY" && historyProjects.size === 1 && historyProjects.has(projectId);
                  return <li key={asset.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 text-xs">
                    <span><strong>{asset.mediaKind === "image" ? language === "en" ? "Image" : "Görsel" : "Video"}</strong><small className="ml-2 text-slate-500">{usageLabel(asset)}</small></span>
                    {canCleanHistory && <button type="button" disabled={pendingAssetId === asset.id} onClick={() => void mutateAsset(asset, "trash")} className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-600 disabled:opacity-40">{language === "en" ? "Remove from history & move to Trash" : "Geçmişten çıkar ve Çöp Kutusuna taşı"}</button>}
                    {asset.cleanupState === "HISTORY_ONLY" && !canCleanHistory && <small className="text-amber-700">{historyProjects.size > 1 ? language === "en" ? "Used in history of multiple projects." : "Birden fazla projenin geçmişinde kullanılıyor." : language === "en" ? "Managed from its project." : "Kendi projesinden yönetilir."}</small>}
                  </li>;
                })}
              </ul>
            </details>}

            <details className="mt-4 rounded-xl border border-slate-200 bg-white p-3" data-media-trash="true">
              <summary className="cursor-pointer text-xs font-semibold text-slate-700">{language === "en" ? "Trash" : "Çöp Kutusu"} · {trashedAssets.length}</summary>
              <p className="mt-2 text-xs leading-5 text-slate-500">{language === "en" ? "Items in Trash still use storage until permanently removed." : "Çöp Kutusundaki dosyalar kalıcı olarak kaldırılana kadar depolama alanı kullanmaya devam eder."}</p>
              {trashedAssets.length > 0 && <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{trashedAssets.map((asset) => <li key={asset.id} className="overflow-hidden rounded-lg border border-slate-200">
                {asset.publicUrl && asset.mediaKind === "image" ? <img src={asset.publicUrl} alt="" className="aspect-video w-full bg-slate-100 object-cover" loading="lazy" /> : asset.publicUrl ? <video src={asset.publicUrl} preload="metadata" className="aspect-video w-full bg-slate-950 object-contain" /> : null}
                <div className="p-3 text-xs">
                  <span className="text-slate-500">{asset.mediaKind} · {formatBytes(asset.sizeBytes)}</span>
                  {asset.trashedAt && <span className="mt-1 block text-[11px] text-slate-500">{language === "en" ? "Trashed" : "Çöpe taşındı"}: {new Date(asset.trashedAt).toLocaleDateString(language)}</span>}
                  {asset.purgePending ? <p className="mt-2 rounded bg-amber-50 p-2 text-amber-800">{language === "en" ? "Permanent deletion requires recovery." : "Kalıcı silme işlemi kurtarma gerektiriyor."}</p> : <button type="button" disabled={pendingAssetId === asset.id} onClick={() => void mutateAsset(asset, "restore")} className="mt-2 w-full rounded-lg border border-blue-300 px-3 py-2 font-semibold text-blue-700 disabled:opacity-40">{language === "en" ? "Restore" : "Geri Yükle"}</button>}
                  {!asset.purgePending && asset.purgeDaysRemaining !== null && asset.purgeDaysRemaining > 0 && <p className="mt-2 text-[11px] text-slate-500">{language === "en" ? `Permanent deletion available in ${asset.purgeDaysRemaining} days.` : `Kalıcı silme ${asset.purgeDaysRemaining} gün sonra kullanılabilir.`}</p>}
                  {asset.permanentDeleteEnabled && asset.permanentDeleteEligible && purgeConfirmAssetId !== asset.id && <button type="button" onClick={() => setPurgeConfirmAssetId(asset.id)} className="mt-2 w-full rounded-lg border border-red-300 px-3 py-2 font-semibold text-red-700">{language === "en" ? "Delete permanently" : "Kalıcı olarak sil"}</button>}
                  {asset.permanentDeleteEnabled && asset.permanentDeleteEligible && purgeConfirmAssetId === asset.id && <div className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2 text-red-950"><p>{language === "en" ? "This permanently removes the file and cannot be undone." : "Bu işlem dosyayı kalıcı olarak kaldırır ve geri alınamaz."}</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => setPurgeConfirmAssetId("")} className="rounded-lg border border-slate-300 px-2 py-2 font-semibold">{language === "en" ? "Cancel" : "İptal"}</button><button type="button" disabled={pendingAssetId === asset.id} onClick={() => void mutateAsset(asset, "purge")} className="rounded-lg bg-red-700 px-2 py-2 font-semibold text-white disabled:opacity-40">{language === "en" ? "Confirm permanent deletion" : "Kalıcı silmeyi onayla"}</button></div></div>}
                </div>
              </li>)}</ul>}
            </details>
          </section>
        )}
      </div>
    </details>
  );
}
