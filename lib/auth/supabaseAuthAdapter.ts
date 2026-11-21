import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type {
  AuthService,
  AuthSession,
  AuthUser,
  SignUpInput,
  SignUpResult,
} from "./types";
import {
  createSingleFlight,
  isLockAcquireTimeout,
  retryLockAcquireOnce,
} from "./singleFlight";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toAuthUser(user: User): AuthUser {
  const displayName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";

  return {
    id: user.id,
    email: user.email || "",
    emailVerified: Boolean(user.email_confirmed_at),
    displayName: displayName || undefined,
  };
}

function toAuthSession(session: Session): AuthSession {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
    user: toAuthUser(session.user),
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isInvalidRefreshTokenError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const value = error as { code?: unknown; message?: unknown };
  const code = String(value.code || "").toLowerCase();
  const message = String(value.message || "").toLowerCase();

  return (
    code === "refresh_token_not_found" ||
    code === "refresh_token_already_used" ||
    message.includes("invalid refresh token") ||
    message.includes("refresh token not found") ||
    message.includes("refresh token already used")
  );
}

function removeStoredSupabaseSession() {
  if (typeof window === "undefined") return;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return;

    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    if (projectRef) {
      window.localStorage.removeItem(`sb-${projectRef}-auth-token`);
    }
  } catch {
    // Invalid environment data should not prevent the app from treating the session as signed out.
  }
}

async function clearInvalidLocalSession() {
  removeStoredSupabaseSession();

  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // The stale token is already unusable. The next successful sign-in replaces it.
  }
}

async function loadSession(): Promise<AuthSession | null> {
  try {
    const { data, error } = await retryLockAcquireOnce(async () => {
      const result = await supabase.auth.getSession();
      if (isLockAcquireTimeout(result.error)) throw result.error;
      return result;
    });

    if (error) {
      if (isInvalidRefreshTokenError(error)) {
        await clearInvalidLocalSession();
        return null;
      }

      throw new Error(getErrorMessage(error, "Oturum bilgisi alınamadı."));
    }

    return data.session ? toAuthSession(data.session) : null;
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await clearInvalidLocalSession();
      return null;
    }
    if (isLockAcquireTimeout(error)) {
      throw new Error(getErrorMessage(error, "Oturum bilgisi alınamadı."), {
        cause: error,
      });
    }
    throw error;
  }
}

const getSessionSingleFlight = createSingleFlight(loadSession);

export class SupabaseAuthAdapter implements AuthService {
  async signIn(email: string, password: string): Promise<AuthSession> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });

    if (error || !data.session) {
      throw new Error(error?.message || "Giriş bilgileri doğrulanamadı.");
    }

    return toAuthSession(data.session);
  }

  async signUp(input: SignUpInput): Promise<SignUpResult> {
    const { data, error } = await supabase.auth.signUp({
      email: normalizeEmail(input.email),
      password: input.password,
      options: {
        emailRedirectTo: input.emailRedirectTo,
        data: {
          display_name: input.displayName?.trim() || null,
          accepted_terms_at: input.acceptedTermsAt,
          accepted_privacy_at: input.acceptedPrivacyAt,
          terms_version: input.termsVersion,
          privacy_version: input.privacyVersion,
          policy_locale: input.policyLocale,
          product: "velto_studio",
        },
      },
    });

    if (error) {
      throw new Error(error.message || "Hesap oluşturulamadı.");
    }

    return {
      user: data.user ? toAuthUser(data.user) : null,
      session: data.session ? toAuthSession(data.session) : null,
      requiresEmailVerification: Boolean(data.user && !data.session),
    };
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error && !isInvalidRefreshTokenError(error)) {
      throw new Error(error.message || "Oturum kapatılamadı.");
    }
  }

  async requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizeEmail(email),
      { redirectTo },
    );

    if (error) {
      throw new Error(error.message || "Parola sıfırlama bağlantısı gönderilemedi.");
    }
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      throw new Error(error.message || "Parola güncellenemedi.");
    }
  }

  async getSession(): Promise<AuthSession | null> {
    return getSessionSingleFlight();
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      if (isInvalidRefreshTokenError(error)) {
        await clearInvalidLocalSession();
      }
      return null;
    }

    return data.user ? toAuthUser(data.user) : null;
  }
}
