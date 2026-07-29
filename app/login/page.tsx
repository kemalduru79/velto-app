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

const copy = {
  tr: {
    title: "Giriş Yap",
    description:
      "Projelerine, üretim akışlarına ve kredi bilgilerine güvenli şekilde eriş.",
    creatorReturn:
      "Giriş tamamlandığında doğrudan Velto Studio üretim alanına döneceksin.",
    email: "E-posta",
    emailPlaceholder: "ornek@mail.com",
    password: "Şifre",
    passwordPlaceholder: "Şifren",
    forgotPassword: "Şifremi unuttum",
    submit: "Giriş Yap",
    submitting: "Giriş yapılıyor...",
    noAccount: "Hesabın yok mu?",
    signup: "Kayıt Ol",
    missingFields: "Lütfen e-posta adresini ve şifreni gir.",
    unexpectedError: "Giriş sırasında beklenmeyen bir hata oluştu.",
    invalidCredentials: "E-posta adresi veya şifre hatalı.",
    emailNotConfirmed: "Giriş yapmadan önce e-posta adresini doğrulamalısın.",
    languageLabel: "Dil",
  },
  en: {
    title: "Sign In",
    description:
      "Securely access your projects, production workflows and credit information.",
    creatorReturn:
      "After signing in, you will return directly to the Velto Studio production workspace.",
    email: "Email",
    emailPlaceholder: "example@email.com",
    password: "Password",
    passwordPlaceholder: "Your password",
    forgotPassword: "Forgot password",
    submit: "Sign In",
    submitting: "Signing in...",
    noAccount: "Do not have an account?",
    signup: "Create Account",
    missingFields: "Enter your email address and password.",
    unexpectedError: "An unexpected error occurred while signing in.",
    invalidCredentials: "The email address or password is incorrect.",
    emailNotConfirmed: "Confirm your email address before signing in.",
    languageLabel: "Language",
  },
} as const;

function localizeAuthError(message: string, language: Language) {
  const normalized = message.toLowerCase();
  const t = copy[language];

  if (normalized.includes("invalid login credentials")) {
    return t.invalidCredentials;
  }

  if (normalized.includes("email not confirmed")) {
    return t.emailNotConfirmed;
  }

  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const t = copy[language];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [returnTo, setReturnTo] = useState(DEFAULT_AUTH_RETURN_TO);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password) {
      setError(t.missingFields);
      return;
    }

    setLoading(true);
    setError("");

    try {
      await authService.signIn(email, password);
      router.replace(returnTo);
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? localizeAuthError(caughtError.message, language)
          : t.unexpectedError,
      );
    } finally {
      setLoading(false);
    }
  };

  const isCreatorStudioReturn = returnTo.includes("flow=creator_lab");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe_0%,_#f8fafc_42%,_#eef2ff_100%)] px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-md rounded-[2rem] border border-white/80 bg-white/85 p-7 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
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

        <div className="mt-3 space-y-3">
          <p className="text-sm leading-6 text-slate-600">{t.description}</p>
          {isCreatorStudioReturn && (
            <p className="rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm font-medium text-sky-800">
              {t.creatorReturn}
            </p>
          )}
        </div>

        <form className="mt-7 space-y-4" onSubmit={handleLogin}>
          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>{t.email}</span>
            <input
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              value={email}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setEmail(event.target.value)
              }
              placeholder={t.emailPlaceholder}
            />
          </label>

          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span className="flex items-center justify-between gap-3">
              <span>{t.password}</span>
              <Link
                href={buildLocalizedAuthHref("/forgot-password")}
                className="text-xs font-semibold text-sky-700 hover:underline"
              >
                {t.forgotPassword}
              </Link>
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              value={password}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setPassword(event.target.value)
              }
              placeholder={t.passwordPlaceholder}
            />
          </label>

          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
            >
              {error}
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
            {t.noAccount}{" "}
            <Link
              href={buildLocalizedAuthHref("/signup")}
              className="font-semibold text-sky-700 hover:underline"
            >
              {t.signup}
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
