"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { authService } from "@/lib/auth";
import { createTrailingSingleFlight } from "@/lib/auth/singleFlight";
import type { AuthUser } from "@/lib/auth/types";
import { buildAuthHref, getCurrentReturnTo } from "@/lib/auth/redirects";
import { useLanguage } from "@/lib/useLanguage";

type Tone = "light" | "dark";

type CreditAccount = {
  availableCredits: number;
  reservedCredits: number;
  balanceCredits: number;
};

type Props = {
  tone?: Tone;
  className?: string;
};

const menuCopy = {
  tr: {
    account: "Hesap",
    credits: "kredi",
    available: "Kullanılabilir",
    reserved: "Rezerve",
    switchUser: "Kullanıcı değiştir",
    switching: "Hazırlanıyor…",
    signOut: "Çıkış yap",
    signingOut: "Çıkış yapılıyor…",
    signOutError: "Oturum kapatılamadı.",
  },
  en: {
    account: "Account",
    credits: "credits",
    available: "Available",
    reserved: "Reserved",
    switchUser: "Switch user",
    switching: "Preparing…",
    signOut: "Sign out",
    signingOut: "Signing out…",
    signOutError: "The session could not be closed.",
  },
} as const;

export default function UserAccountMenu({
  tone = "light",
  className = "",
}: Props) {
  const router = useRouter();
  const { language } = useLanguage();
  const t = menuCopy[language];
  const menuRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);
  const accountLoaderRef = useRef<
    ReturnType<typeof createTrailingSingleFlight<void>> | undefined
  >(undefined);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [account, setAccount] = useState<CreditAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"logout" | "switch" | null>(null);
  const [error, setError] = useState("");

  const performAccountLoad = useCallback(async () => {
    try {
      const session = await authService.getSession();
      if (!mountedRef.current) return;
      setUser(session?.user || null);

      if (!session?.accessToken) {
        setAccount(null);
        return;
      }

      const response = await fetch("/api/credits", {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);

      if (mountedRef.current && response.ok && data?.account) {
        setAccount(data.account);
      }
    } catch (caughtError) {
      console.error("account menu load error:", caughtError);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const loadAccount = createTrailingSingleFlight(
      performAccountLoad,
      () => mountedRef.current,
    );
    accountLoaderRef.current = loadAccount;
    void loadAccount();

    const handleFocus = () => void loadAccount();
    const handleCreditChange = (event: Event) => {
      const nextAccount = (
        event as CustomEvent<{ account?: CreditAccount | null }>
      ).detail?.account;

      if (nextAccount) {
        setAccount(nextAccount);
        return;
      }

      void loadAccount(true);
    };
    window.addEventListener("focus", handleFocus);
    window.addEventListener("velto:credits-changed", handleCreditChange);

    return () => {
      mountedRef.current = false;
      accountLoaderRef.current = undefined;
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("velto:credits-changed", handleCreditChange);
    };
  }, [performAccountLoad]);

  useEffect(() => {
    if (open) void accountLoaderRef.current?.();
  }, [open]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSignOut = async (mode: "logout" | "switch") => {
    setAction(mode);
    setError("");

    try {
      const returnTo = getCurrentReturnTo();
      await authService.signOut();
      setOpen(false);
      router.replace(
        mode === "switch" ? buildAuthHref("/login", returnTo) : "/",
      );
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : t.signOutError,
      );
    } finally {
      setAction(null);
    }
  };

  if (!loading && !user) return null;

  const displayName =
    user?.displayName || user?.email?.split("@")[0] || t.account;
  const initial = displayName.slice(0, 1).toLocaleUpperCase(
    language === "tr" ? "tr-TR" : "en-US",
  );
  const isDark = tone === "dark";

  return (
    <div ref={menuRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          isDark
            ? "inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-2.5 py-2 text-white shadow-[0_16px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl transition hover:bg-white/[0.12]"
            : "inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-2.5 py-2 text-slate-900 shadow-[0_14px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl transition hover:bg-white"
        }
      >
        <span
          className={
            isDark
              ? "flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black text-slate-950"
              : "flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white"
          }
        >
          {loading ? "…" : initial}
        </span>
        <span className="hidden max-w-28 truncate text-xs font-bold sm:inline">
          {displayName}
        </span>
        <span aria-hidden="true" className="px-0.5 text-xs opacity-60">
          ⌄
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className={
            isDark
              ? "absolute right-0 top-[calc(100%+0.6rem)] z-[160] w-72 overflow-hidden rounded-[24px] border border-white/10 bg-[#101827]/95 p-2 text-white shadow-[0_28px_90px_rgba(0,0,0,0.48)] backdrop-blur-2xl"
              : "absolute right-0 top-[calc(100%+0.6rem)] z-[160] w-72 overflow-hidden rounded-[24px] border border-slate-200 bg-white/95 p-2 text-slate-950 shadow-[0_28px_90px_rgba(15,23,42,0.18)] backdrop-blur-2xl"
          }
        >
          <div
            className={
              isDark
                ? "rounded-[18px] bg-white/[0.06] p-4"
                : "rounded-[18px] bg-slate-50 p-4"
            }
          >
            <p className="truncate text-sm font-black">{displayName}</p>
            <p
              className={
                isDark
                  ? "mt-1 truncate text-xs text-white/55"
                  : "mt-1 truncate text-xs text-slate-500"
              }
            >
              {user?.email}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div
                className={
                  isDark
                    ? "rounded-2xl border border-white/10 bg-white/[0.05] p-3"
                    : "rounded-2xl border border-slate-200 bg-white p-3"
                }
              >
                <p
                  className={
                    isDark
                      ? "text-[10px] font-bold uppercase tracking-[0.12em] text-white/45"
                      : "text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"
                  }
                >
                  {t.available}
                </p>
                <p className="mt-1 text-xl font-black">
                  {account?.availableCredits ?? "—"}
                </p>
              </div>
              <div
                className={
                  isDark
                    ? "rounded-2xl border border-white/10 bg-white/[0.05] p-3"
                    : "rounded-2xl border border-slate-200 bg-white p-3"
                }
              >
                <p
                  className={
                    isDark
                      ? "text-[10px] font-bold uppercase tracking-[0.12em] text-white/45"
                      : "text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"
                  }
                >
                  {t.reserved}
                </p>
                <p className="mt-1 text-xl font-black">
                  {account?.reservedCredits ?? "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-2 grid gap-1">
            <button
              role="menuitem"
              type="button"
              disabled={Boolean(action)}
              onClick={() => void handleSignOut("switch")}
              className={
                isDark
                  ? "rounded-2xl px-4 py-3 text-left text-sm font-bold text-white/80 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                  : "rounded-2xl px-4 py-3 text-left text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              }
            >
              {action === "switch" ? t.switching : t.switchUser}
            </button>
            <button
              role="menuitem"
              type="button"
              disabled={Boolean(action)}
              onClick={() => void handleSignOut("logout")}
              className="rounded-2xl px-4 py-3 text-left text-sm font-bold text-rose-500 transition hover:bg-rose-500/10 disabled:opacity-50"
            >
              {action === "logout" ? t.signingOut : t.signOut}
            </button>
          </div>

          {error && (
            <p
              role="alert"
              className="m-2 rounded-2xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-500"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
