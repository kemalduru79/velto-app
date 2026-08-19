"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type StorageStatus = {
  configured: boolean;
  usedBytes: number;
  trashedBytes: number;
  additionalEntitlementBytes: number;
  limitBytes: number | null;
  usageRatio: number | null;
  state: "NORMAL" | "APPROACHING" | "CRITICAL" | "FULL" | null;
  decision: "UNCONFIGURED" | "ALLOWED" | "FULL_BUT_NOT_ENFORCED" | "BLOCKED_FULL";
};

const formatBytes = (bytes: number) => bytes >= 1_000_000
  ? `${(bytes / 1_000_000).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1_000))} KB`;

export default function CreatorVisualStorageStatus({
  language,
  getAccessToken,
}: {
  language: "en" | "tr";
  getAccessToken: () => Promise<string>;
}) {
  const mountProbeRef = useRef<HTMLSpanElement | null>(null);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/storage-usage", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json() as { storage?: StorageStatus };
      if (!response.ok || !payload.storage) throw new Error("Storage status unavailable.");
      setStorage(payload.storage);
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    }
  }, [getAccessToken]);

  useEffect(() => {
    // Defer the first request until after the listener effect has committed;
    // subsequent refreshes are driven by the media-inventory event callback.
    const initialLoad = window.setTimeout(() => {
      void load();
    }, 0);
    const refresh = () => void load();
    window.addEventListener("velto:media-inventory-changed", refresh);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("velto:media-inventory-changed", refresh);
    };
  }, [load]);

  const warning = storage?.state === "FULL" || storage?.state === "CRITICAL";
  const approaching = storage?.state === "APPROACHING";
  const blocked = storage?.decision === "BLOCKED_FULL";
  const shouldShowNotice = Boolean(warning || approaching || blocked);

  useEffect(() => {
    const mount = mountProbeRef.current?.parentElement;
    if (!mount || mount.getAttribute("data-visual-storage-status-mount") !== "true") return;

    // Storage is supporting information, not a primary Visuals grid card.
    // Keep normal/unconfigured states out of the layout; surface only quota warnings.
    mount.style.display = shouldShowNotice ? "block" : "none";
    mount.style.gridColumn = shouldShowNotice ? "1 / -1" : "";

    return () => {
      mount.style.display = "";
      mount.style.gridColumn = "";
    };
  }, [shouldShowNotice]);

  if (!shouldShowNotice || !storage) {
    return <span ref={mountProbeRef} className="hidden" aria-hidden="true" />;
  }

  return (
    <>
      <span ref={mountProbeRef} className="hidden" aria-hidden="true" />
      <section
        className={`rounded-xl border px-3 py-2.5 ${warning ? "border-amber-300 bg-amber-50" : "border-blue-200 bg-blue-50/50"}`}
        data-storage-quota-state={storage.state || "UNCONFIGURED"}
        data-visual-storage-status="true"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <strong className="text-slate-700">
            {language === "en" ? "Storage notice" : "Depolama uyarısı"}
          </strong>
          <span className="text-slate-500">
            {formatBytes(storage.usedBytes)}
            {storage.configured && storage.limitBytes ? ` ${language === "en" ? "of" : "/"} ${formatBytes(storage.limitBytes)}` : ""}
          </span>
        </div>

        {storage.configured && storage.usageRatio !== null && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(storage.usageRatio * 100))}>
            <span className={`block h-full rounded-full ${warning ? "bg-amber-600" : "bg-blue-600"}`} style={{ width: `${Math.min(100, storage.usageRatio * 100)}%` }} />
          </div>
        )}

        <p className={`mt-2 text-[11px] leading-5 ${warning ? "text-amber-950" : "text-slate-600"}`}>
          {blocked
            ? language === "en"
              ? "Storage is full. New image and video generation is temporarily unavailable."
              : "Depolama alanı dolu. Yeni görsel ve video üretimi geçici olarak kullanılamıyor."
            : language === "en"
              ? "Storage usage is approaching its limit."
              : "Depolama kullanımı sınıra yaklaşıyor."}
        </p>

        {blocked && (
          <button
            type="button"
            onClick={() => document.querySelector('[data-visual-media-cleanup="asset-version"]')?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className="mt-1 text-[11px] font-semibold text-amber-900 underline underline-offset-2"
          >
            {language === "en" ? "Review media versions" : "Medya sürümlerini gözden geçir"}
          </button>
        )}
      </section>
    </>
  );
}
