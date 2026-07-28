import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type {
  AuthService,
  AuthSession,
  AuthUser,
  SignUpInput,
  SignUpResult,
} from "./types";

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
    const { error } = await supabase.auth.signOut();

    if (error) {
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
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw new Error(getErrorMessage(error, "Oturum bilgisi alınamadı."));
    }

    return data.session ? toAuthSession(data.session) : null;
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      return null;
    }

    return data.user ? toAuthUser(data.user) : null;
  }
}
