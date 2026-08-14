"use client";

import Link from "next/link";
import UserAccountMenu from "@/components/auth/UserAccountMenu";
import { useLanguage } from "@/lib/useLanguage";

type Tone = "light" | "dark";
type ActiveSurface = "products" | "studio" | "storyverse" | "reports";
type Variant = "floating" | "creatorlab";

type Props = {
  tone?: Tone;
  active?: ActiveSurface;
  className?: string;
  showAccount?: boolean;
  variant?: Variant;
  onStudioClick?: () => void;
};

function GridIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </svg>
  );
}

function StudioIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" />
      <path d="m4.5 7.8 7.5 4.1 7.5-4.1" />
      <path d="M12 12v9" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 19V9" />
      <path d="M12 19V5" />
      <path d="M19 19v-7" />
      <path d="M3 19h18" />
    </svg>
  );
}

export default function ProductTopNavigation({
  tone = "light",
  active,
  className = "",
  showAccount = true,
  variant = "floating",
  onStudioClick,
}: Props) {
  const { language } = useLanguage();
  const isDark = tone === "dark";
  const productsLabel = language === "en" ? "Products" : "Ürünler";
  const studioLabel = "Velto Studio";
  const newProjectLabel = language === "en" ? "New project" : "Yeni proje";
  const newProjectShortLabel = language === "en" ? "New" : "Yeni";
  const reportsLabel = language === "en" ? "Reports" : "Raporlar";

  if (variant === "creatorlab") {
    return (
      <nav
        aria-label={language === "en" ? "Product navigation" : "Ürün navigasyonu"}
        className={`flex items-center gap-2 ${className}`}
      >
        <Link
          href="/dashboard"
          className="creatorlab-topbar-tool-button"
          aria-current={active === "products" ? "page" : undefined}
        >
          <GridIcon />
          <span>{productsLabel}</span>
        </Link>
        {onStudioClick ? (
          <button
            type="button"
            onClick={onStudioClick}
            className="creatorlab-topbar-tool-button"
            aria-label={language === "en" ? "Start a new Velto Studio project" : "Yeni bir Velto Studio projesi başlat"}
          >
            <StudioIcon />
            <span className="hidden 2xl:inline">{newProjectLabel}</span>
            <span className="2xl:hidden">{newProjectShortLabel}</span>
          </button>
        ) : (
          <Link
            href="/create?flow=creator_lab"
            className="creatorlab-topbar-tool-button"
            aria-current={active === "studio" ? "page" : undefined}
          >
            <StudioIcon />
            <span className="hidden 2xl:inline">{studioLabel}</span>
            <span className="2xl:hidden">Studio</span>
          </Link>
        )}
        <Link
          href="/reports"
          className="creatorlab-topbar-tool-button"
          aria-current={active === "reports" ? "page" : undefined}
        >
          <ReportsIcon />
          <span>{reportsLabel}</span>
        </Link>
        {showAccount && <UserAccountMenu tone={tone} />}
      </nav>
    );
  }

  const linkClass = (isActive: boolean) => {
    if (isDark) {
      return isActive
        ? "rounded-full bg-white px-3 py-2 text-xs font-black text-slate-950 shadow-sm"
        : "rounded-full px-3 py-2 text-xs font-black text-white/72 transition hover:bg-white/10 hover:text-white";
    }

    return isActive
      ? "rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white shadow-sm"
      : "rounded-full px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950";
  };

  return (
    <nav
      aria-label={language === "en" ? "Product navigation" : "Ürün navigasyonu"}
      className={`flex items-center gap-1.5 ${className}`}
    >
      <div
        className={
          isDark
            ? "inline-flex items-center rounded-full border border-white/10 bg-white/[0.07] p-1 shadow-[0_16px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl"
            : "inline-flex items-center rounded-full border border-slate-200/80 bg-white/90 p-1 shadow-[0_14px_45px_rgba(15,23,42,0.10)] backdrop-blur-xl"
        }
      >
        <Link
          href="/dashboard"
          className={linkClass(active === "products")}
          aria-current={active === "products" ? "page" : undefined}
        >
          {productsLabel}
        </Link>
        <Link
          href="/create?flow=creator_lab"
          className={linkClass(active === "studio")}
          aria-current={active === "studio" ? "page" : undefined}
        >
          <span className="sm:hidden">Studio</span>
          <span className="hidden sm:inline">{studioLabel}</span>
        </Link>
        <Link
          href="/reports"
          className={linkClass(active === "reports")}
          aria-current={active === "reports" ? "page" : undefined}
        >
          {reportsLabel}
        </Link>
      </div>

      {showAccount && <UserAccountMenu tone={tone} />}
    </nav>
  );
}
