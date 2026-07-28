"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useState } from "react";
import { authService } from "@/lib/auth";

const MIN_PASSWORD_LENGTH = 8;

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim() || !password) {
      setError("Lütfen e-posta adresini ve şifreni gir.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Şifreler birbiriyle eşleşmiyor.");
      return;
    }

    if (!termsAccepted) {
      setError("Hesap oluşturmak için kullanım ve gizlilik koşullarını kabul etmelisin.");
      return;
    }

    setLoading(true);

    try {
      const result = await authService.signUp({
        email,
        password,
        displayName,
        acceptedTermsAt: new Date().toISOString(),
        emailRedirectTo: `${window.location.origin}/login`,
      });

      if (result.session) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      setMessage(
        result.requiresEmailVerification
          ? "Hesabın oluşturuldu. E-posta adresine gönderilen doğrulama bağlantısını açtıktan sonra giriş yapabilirsin."
          : "Hesabın oluşturuldu. Şimdi giriş yapabilirsin.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Kayıt sırasında beklenmeyen bir hata oluştu.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ede9fe_0%,_#f8fafc_45%,_#e0f2fe_100%)] px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-md rounded-[2rem] border border-white/80 bg-white/85 p-7 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="space-y-2">
          <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-violet-700">
            Velto Studio
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Hesap Oluştur</h1>
          <p className="text-sm leading-6 text-slate-600">
            Projelerini, üretim geçmişini ve kredi hareketlerini kendi hesabında sakla.
          </p>
        </div>

        <form className="mt-7 space-y-4" onSubmit={handleSignup}>
          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>Ad veya görünen isim</span>
            <input
              type="text"
              autoComplete="name"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              value={displayName}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setDisplayName(event.target.value)}
              placeholder="Kemal"
            />
          </label>

          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>E-posta</span>
            <input
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              value={email}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
              placeholder="ornek@mail.com"
            />
          </label>

          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>Şifre</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              value={password}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
              placeholder="En az 8 karakter"
            />
          </label>

          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>Şifreyi doğrula</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              value={confirmPassword}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setConfirmPassword(event.target.value)}
              placeholder="Şifreni tekrar gir"
            />
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-5 text-slate-600">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
              checked={termsAccepted}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setTermsAccepted(event.target.checked)}
            />
            <span>Kullanım koşullarını ve gizlilik politikasını kabul ediyorum.</span>
          </label>

          {error && (
            <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          )}

          {message && (
            <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-slate-950 px-6 py-3.5 font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Hesap oluşturuluyor..." : "Kayıt Ol"}
          </button>

          <p className="text-center text-sm text-slate-600">
            Zaten hesabın var mı?{" "}
            <Link href="/login" className="font-semibold text-violet-700 hover:underline">
              Giriş Yap
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
