export const DEFAULT_AUTH_RETURN_TO = "/dashboard";

const SAFE_ORIGIN = "https://velto.local";

export function normalizeAuthReturnTo(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_RETURN_TO,
) {
  const candidate = String(value || "").trim();

  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(candidate)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, SAFE_ORIGIN);

    if (parsed.origin !== SAFE_ORIGIN) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}` || fallback;
  } catch {
    return fallback;
  }
}

export function getReturnToFromSearch(
  search: string,
  fallback = DEFAULT_AUTH_RETURN_TO,
) {
  const params = new URLSearchParams(search);
  return normalizeAuthReturnTo(params.get("returnTo"), fallback);
}

export function buildAuthHref(pathname: string, returnTo: string) {
  const safeReturnTo = normalizeAuthReturnTo(returnTo);
  return `${pathname}?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

export function getCurrentReturnTo(fallback = DEFAULT_AUTH_RETURN_TO) {
  if (typeof window === "undefined") {
    return fallback;
  }

  return normalizeAuthReturnTo(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
    fallback,
  );
}
