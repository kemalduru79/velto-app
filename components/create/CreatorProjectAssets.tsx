"use client";

import { useMemo } from "react";
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

export default function CreatorProjectAssets({
  scenes,
  targetCreatorSceneId,
  disabled = false,
  language,
  onUseImage,
}: CreatorProjectAssetsProps) {
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
              ? "Reuse assets already available in this project. Media cleanup is managed directly from each scene's Visual tab."
              : "Bu projede bulunan varlıkları yeniden kullanın. Medya temizliği doğrudan her sahnenin Görsel sekmesinden yönetilir."}
          </p>
          <p className="mt-1 text-xs font-medium text-emerald-700">
            {language === "en" ? "No generation credits used" : "Üretim kredisi kullanılmaz"}
          </p>
        </div>

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
      </div>
    </details>
  );
}
