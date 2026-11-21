"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { authService } from "@/lib/auth";
import {
  buildAuthHref,
  DEFAULT_AUTH_RETURN_TO,
  getReturnToFromSearch,
} from "@/lib/auth/redirects";
import { useLanguage, type Language } from "@/lib/useLanguage";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal/policy";

const MIN_PASSWORD_LENGTH = 8;

const copy = {
  tr: {
    title: "Hesap Oluştur",
    description:
      "Projelerini, üretim geçmişini ve kredi hareketlerini kendi hesabında sakla.",
    displayName: "Ad veya görünen isim",
    displayNamePlaceholder: "Kemal",
    email: "E-posta",
    emailPlaceholder: "ornek@mail.com",
    password: "Şifre",
    passwordPlaceholder: "En az 8 karakter",
    confirmPassword: "Şifreyi doğrula",
    confirmPasswordPlaceholder: "Şifreni tekrar gir",
    termsPrefix: "",
    termsLink: "Kullanım Koşulları'nı",
    termsJoin: " ve ",
    privacyLink: "Gizlilik Politikası'nı",
    termsSuffix: " kabul ediyorum.",
    submit: "Kayıt Ol",
    submitting: "Hesap oluşturuluyor...",
    hasAccount: "Zaten hesabın var mı?",
    signIn: "Giriş Yap",
    languageLabel: "Dil",
    missingFields: "Lütfen e-posta adresini ve şifreni gir.",
    passwordLength: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`,
    passwordMismatch: "Şifreler birbiriyle eşleşmiyor.",
    termsRequired:
      "Hesap oluşturmak için kullanım ve gizlilik koşullarını kabul etmelisin.",
    verificationRequired:
      "Hesabın oluşturuldu. E-posta adresine gönderilen doğrulama bağlantısını açtıktan sonra giriş yapabilirsin.",
    accountCreated: "Hesabın oluşturuldu. Şimdi giriş yapabilirsin.",
    unexpectedError: "Kayıt sırasında beklenmeyen bir hata oluştu.",
    userAlreadyRegistered: "Bu e-posta adresiyle daha önce hesap oluşturulmuş.",
  },
  en: {
    title: "Create Account",
    description:
      "Keep your projects, production history and credit activity in your own account.",
    displayName: "Name or display name",
    displayNamePlaceholder: "Alex",
    email: "Email",
    emailPlaceholder: "example@email.com",
    password: "Password",
    passwordPlaceholder: "At least 8 characters",
    confirmPassword: "Confirm password",
    confirmPasswordPlaceholder: "Enter your password again",
    termsPrefix: "I accept the ",
    termsLink: "Terms of Use",
    termsJoin: " and ",
    privacyLink: "Privacy Policy",
    termsSuffix: ".",
    submit: "Create Account",
    submitting: "Creating account...",
    hasAccount: "Already have an account?",
    signIn: "Sign In",
    languageLabel: "Language",
    missingFields: "Enter your email address and password.",
    passwordLength: `Password must contain at least ${MIN_PASSWORD_LENGTH} characters.`,
    passwordMismatch: "The passwords do not match.",
    termsRequired:
      "You must accept the terms of use and privacy policy to create an account.",
    verificationRequired:
      "Your account has been created. Open the verification link sent to your email address before signing in.",
    accountCreated: "Your account has been created. You can now sign in.",
    unexpectedError: "An unexpected error occurred while creating the account.",
    userAlreadyRegistered: "An account already exists for this email address.",
  },
} as const;

function localizeSignupError(message: string, language: Language) {
  const normalized = message.toLowerCase();
  const t = copy[language];

  if (
    normalized.includes("user already registered") ||
    normalized.includes("already been registered")
  ) {
    return t.userAlreadyRegistered;
  }

  return message;
}

export default function SignupPage() {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const t = copy[language];
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [returnTo, setReturnTo] = useState(DEFAULT_AUTH_RETURN_TO);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const buildLocalizedAuthHref = (pathname: string) =>
    `${buildAuthHref(pathname, returnTo)}&lang=${language}`;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedLanguage = params.get("lang");

    setReturnTo(getReturnToFromSearch(window.location.search));

    if (requestedLanguage === "tr" || requestedLanguage === "en") {
      setLanguage(requestedLanguage);
    }
  }, [setLanguage]);

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim() || !password) {
      setError(t.missingFields);
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t.passwordLength);
      return;
    }

    if (password !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }

    if (!termsAccepted) {
      setError(t.termsRequired);
      return;
    }

    setLoading(true);

    try {
      const acceptedAt = new Date().toISOString();
      const result = await authService.signUp({
        email,
        password,
        displayName,
        acceptedTermsAt: acceptedAt,
        acceptedPrivacyAt: acceptedAt,
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        policyLocale: language,
        emailRedirectTo: `${window.location.origin}${buildLocalizedAuthHref("/login")}`,
      });

      if (result.session) {
        router.replace(returnTo);
        router.refresh();
        return;
      }

      setMessage(
        result.requiresEmailVerification
          ? t.verificationRequired
          : t.accountCreated,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? localizeSignupError(caughtError.message, language)
          : t.unexpectedError,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ede9fe_0%,_#f8fafc_45%,_#e0f2fe_100%)] px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-md rounded-[2rem] border border-white/80 bg-white/85 p-7 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-violet-700">
              Velto Studio
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
          </div>

          <div
            className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-white p-1 text-xs font-bold shadow-sm"
            aria-label={t.languageLabel}
          >
            <button
              type="button"
              onClick={() => setLanguage("tr")}
              className={`rounded-full px-2.5 py-1.5 transition ${
                language === "tr"
                  ? "bg-slate-950 text-white"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              }`}
              aria-pressed={language === "tr"}
            >
              TR
            </button>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`rounded-full px-2.5 py-1.5 transition ${
                language === "en"
                  ? "bg-slate-950 text-white"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              }`}
              aria-pressed={language === "en"}
            >
              EN
            </button>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-600">{t.description}</p>

        <form className="mt-7 space-y-4" onSubmit={handleSignup}>
          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>{t.displayName}</span>
            <input
              type="text"
              autoComplete="name"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              value={displayName}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setDisplayName(event.target.value)
              }
              placeholder={t.displayNamePlaceholder}
            />
          </label>

          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>{t.email}</span>
            <input
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              value={email}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setEmail(event.target.value)
              }
              placeholder={t.emailPlaceholder}
            />
          </label>

          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>{t.password}</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              value={password}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setPassword(event.target.value)
              }
              placeholder={t.passwordPlaceholder}
            />
          </label>

          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>{t.confirmPassword}</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              value={confirmPassword}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setConfirmPassword(event.target.value)
              }
              placeholder={t.confirmPasswordPlaceholder}
            />
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-5 text-slate-600">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
              checked={termsAccepted}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setTermsAccepted(event.target.checked)
              }
            />
            <span>
              {t.termsPrefix}
              <Link href={`/terms?lang=${language}`} className="font-semibold text-violet-700 underline underline-offset-2">
                {t.termsLink}
              </Link>
              {t.termsJoin}
              <Link href={`/privacy?lang=${language}`} className="font-semibold text-violet-700 underline underline-offset-2">
                {t.privacyLink}
              </Link>
              {t.termsSuffix}
            </span>
          </label>

          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
            >
              {error}
            </div>
          )}

          {message && (
            <div
              role="status"
              className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-700"
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-slate-950 px-6 py-3.5 font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? t.submitting : t.submit}
          </button>

          <p className="text-center text-sm text-slate-600">
            {t.hasAccount}{" "}
            <Link
              href={buildLocalizedAuthHref("/login")}
              className="font-semibold text-violet-700 hover:underline"
            >
              {t.signIn}
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
