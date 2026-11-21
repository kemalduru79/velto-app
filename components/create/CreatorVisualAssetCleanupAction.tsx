"use client";

import { useCallback, useEffect, useState } from "react";
import { canonicalCreatorMediaUrl } from "@/lib/creator/projectAssets";

type CleanupAsset = {
  id: string;
  publicUrl: string | null;
  mediaKind: "image" | "video" | "final_video";
  lifecycleState: "active" | "trashed";
  cleanupState: "IN_USE" | "HISTORY_ONLY" | "UNREFERENCED" | "TRASHED";
  referenceSummary: Array<{
    projectId: string;
    referenceType: string;
    referenceKey: string;
  }>;
};

type MediaInventoryPayload = {
  assets?: CleanupAsset[];
  error?: string;
};

let cachedInventoryPromise: Promise<CleanupAsset[]> | null = null;

function clearInventoryCache() {
  cachedInventoryPromise = null;
}

async function loadInventory(getAccessToken: () => Promise<string>) {
  if (!cachedInventoryPromise) {
    cachedInventoryPromise = (async () => {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/media-assets", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json() as MediaInventoryPayload;
      if (!response.ok) {
        throw new Error(payload.error || "Media inventory is unavailable.");
      }
      return payload.assets || [];
    })().catch((error) => {
      clearInventoryCache();
      throw error;
    });
  }
  return cachedInventoryPromise;
}

export default function CreatorVisualAssetCleanupAction({
  mediaUrl,
  projectId,
  language,
  getAccessToken,
  onHistoryRemoved,
}: {
  mediaUrl: string;
  projectId: string;
  language: "en" | "tr";
  getAccessToken: () => Promise<string>;
  onHistoryRemoved: (url: string) => void;
}) {
  const [asset, setAsset] = useState<CleanupAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const inventory = await loadInventory(getAccessToken);
      const target = canonicalCreatorMediaUrl(mediaUrl);
      setAsset(
        inventory.find((item) =>
          item.publicUrl && canonicalCreatorMediaUrl(item.publicUrl) === target,
        ) || null,
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Media inventory is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, mediaUrl]);

  useEffect(() => {
    // Defer the initial refresh so the listener is ready before local state changes begin.
    const initialRefresh = window.setTimeout(() => {
      void refresh();
    }, 0);
    const handleInventoryChange = () => {
      clearInventoryCache();
      void refresh();
    };
    window.addEventListener("velto:media-inventory-changed", handleInventoryChange);
    return () => {
      window.clearTimeout(initialRefresh);
      window.removeEventListener("velto:media-inventory-changed", handleInventoryChange);
    };
  }, [refresh]);

  const mutate = async (action: "trash" | "restore") => {
    if (!asset) return;

    const historyProjects = new Set(asset.referenceSummary.map((reference) => reference.projectId));
    const historyOnlyForThisProject =
      asset.cleanupState === "HISTORY_ONLY" &&
      historyProjects.size === 1 &&
      historyProjects.has(projectId);

    if (action === "trash" && asset.cleanupState === "HISTORY_ONLY") {
      if (!historyOnlyForThisProject) return;
      const confirmed = window.confirm(
        language === "en"
          ? "Remove this version from project history and move it to Trash?"
          : "Bu sürümü proje geçmişinden çıkarıp Çöp Kutusuna taşımak istiyor musunuz?",
      );
      if (!confirmed) return;
    }

    setPending(true);
    setError("");
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(
        `/api/media-assets/${encodeURIComponent(asset.id)}/${action}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body:
            action === "trash" && asset.cleanupState === "HISTORY_ONLY"
              ? JSON.stringify({ projectId })
              : "{}",
        },
      );
      const payload = await response.json() as { error?: string; lifecycleState?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Media lifecycle could not be changed.");
      }

      if (action === "trash" && asset.cleanupState === "HISTORY_ONLY") {
        onHistoryRemoved(mediaUrl);
      }

      clearInventoryCache();
      window.dispatchEvent(new Event("velto:media-inventory-changed"));
      if (action === "trash") {
        setAsset((current) => current ? { ...current, lifecycleState: "trashed", cleanupState: "TRASHED" } : current);
      } else {
        await refresh();
      }
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Media lifecycle could not be changed.");
    } finally {
      setPending(false);
    }
  };

  if (loading) {
    return <span className="block text-[10px] text-slate-400">{language === "en" ? "Checking media…" : "Medya kontrol ediliyor…"}</span>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] leading-4 text-amber-800" role="alert">
        {error}
      </div>
    );
  }

  if (!asset) return null;

  if (asset.cleanupState === "IN_USE") {
    return (
      <span className="block rounded-lg bg-slate-50 px-2.5 py-2 text-[10px] font-semibold text-slate-500" data-media-cleanup-state="in-use">
        {language === "en" ? "In use · protected from deletion" : "Kullanımda · silmeye karşı korumalı"}
      </span>
    );
  }

  if (asset.cleanupState === "TRASHED") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => void mutate("restore")}
        className="min-h-10 w-full rounded-lg border border-blue-200 bg-blue-50 px-2 py-2 text-[11px] font-semibold text-blue-700 disabled:opacity-40"
        data-visual-media-action="restore"
      >
        {pending
          ? language === "en" ? "Restoring…" : "Geri yükleniyor…"
          : language === "en" ? "Restore from Trash" : "Çöp Kutusundan Geri Yükle"}
      </button>
    );
  }

  if (asset.cleanupState === "UNREFERENCED") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => void mutate("trash")}
        className="min-h-10 w-full rounded-lg border border-rose-200 bg-rose-50 px-2 py-2 text-[11px] font-semibold text-rose-700 disabled:opacity-40"
        data-visual-media-action="trash"
      >
        {pending
          ? language === "en" ? "Moving to Trash…" : "Çöp Kutusuna taşınıyor…"
          : language === "en" ? "Move to Trash" : "Çöp Kutusuna Taşı"}
      </button>
    );
  }

  if (asset.cleanupState === "HISTORY_ONLY") {
    const projectIds = new Set(asset.referenceSummary.map((reference) => reference.projectId));
    const canRemove = projectIds.size === 1 && projectIds.has(projectId);
    if (!canRemove) {
      return (
        <span className="block rounded-lg bg-amber-50 px-2.5 py-2 text-[10px] font-semibold text-amber-700">
          {language === "en" ? "Used in another project history" : "Başka bir proje geçmişinde kullanılıyor"}
        </span>
      );
    }
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => void mutate("trash")}
        className="min-h-10 w-full rounded-lg border border-rose-200 bg-rose-50 px-2 py-2 text-[11px] font-semibold text-rose-700 disabled:opacity-40"
        data-visual-media-action="remove-history-trash"
      >
        {pending
          ? language === "en" ? "Moving to Trash…" : "Çöp Kutusuna taşınıyor…"
          : language === "en" ? "Delete this version" : "Bu sürümü sil"}
      </button>
    );
  }

  return null;
}
