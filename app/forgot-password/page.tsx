"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useState } from "react";
import { authService } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim()) {
      setError("Lütfen e-posta adresini gir.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await authService.requestPasswordReset(
        email,
        `${window.location.origin}/reset-password`,
      );
      setMessage(
        "Bu e-posta ile kayıtlı bir hesap varsa parola sıfırlama bağlantısı gönderildi.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "İşlem tamamlanamadı.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60">
        <h1 className="text-3xl font-bold tracking-tight">Şifreni Sıfırla</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Hesabına bağlı e-posta adresini gir. Güvenli sıfırlama bağlantısını e-posta ile göndereceğiz.
        </p>

        <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
          <input
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            value={email}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
            placeholder="ornek@mail.com"
          />

          {error && <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
          {message && <div className="rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-700">{message}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-slate-950 px-6 py-3.5 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Gönderiliyor..." : "Sıfırlama Bağlantısı Gönder"}
          </button>

          <p className="text-center text-sm text-slate-600">
            <Link href="/login" className="font-semibold text-sky-700 hover:underline">
              Giriş ekranına dön
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
