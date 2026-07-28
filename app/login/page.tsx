"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useState } from "react";
import { authService } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password) {
      setError("Lütfen e-posta adresini ve şifreni gir.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await authService.signIn(email, password);
      router.replace("/dashboard");
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Giriş sırasında beklenmeyen bir hata oluştu.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe_0%,_#f8fafc_42%,_#eef2ff_100%)] px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-md rounded-[2rem] border border-white/80 bg-white/85 p-7 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="space-y-2">
          <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
            Velto Studio
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Giriş Yap</h1>
          <p className="text-sm leading-6 text-slate-600">
            Projelerine, üretim akışlarına ve kredi bilgilerine güvenli şekilde eriş.
          </p>
        </div>

        <form className="mt-7 space-y-4" onSubmit={handleLogin}>
          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>E-posta</span>
            <input
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              value={email}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
              placeholder="ornek@mail.com"
            />
          </label>

          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span className="flex items-center justify-between gap-3">
              <span>Şifre</span>
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-sky-700 hover:underline"
              >
                Şifremi unuttum
              </Link>
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              value={password}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
              placeholder="Şifren"
            />
          </label>

          {error && (
            <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-slate-950 px-6 py-3.5 font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>

          <p className="text-center text-sm text-slate-600">
            Hesabın yok mu?{" "}
            <Link href="/signup" className="font-semibold text-sky-700 hover:underline">
              Kayıt Ol
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
