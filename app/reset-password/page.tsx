"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { authService } from "@/lib/auth";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    authService
      .getSession()
      .then((session) => {
        if (!active) return;
        setSessionReady(Boolean(session));
        if (!session) {
          setError("Sıfırlama bağlantısı geçersiz veya süresi dolmuş olabilir.");
        }
      })
      .catch(() => {
        if (active) {
          setError("Sıfırlama oturumu doğrulanamadı.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Yeni şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Şifreler birbiriyle eşleşmiyor.");
      return;
    }

    setLoading(true);

    try {
      await authService.updatePassword(password);
      await authService.signOut();
      router.replace("/login");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Parola güncellenemedi.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60">
        <h1 className="text-3xl font-bold tracking-tight">Yeni Şifre Belirle</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Velto hesabın için yeni ve güçlü bir şifre oluştur.
        </p>

        <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
          <input
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            disabled={!sessionReady}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:bg-slate-100"
            value={password}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
            placeholder="Yeni şifre"
          />
          <input
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            disabled={!sessionReady}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:bg-slate-100"
            value={confirmPassword}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setConfirmPassword(event.target.value)}
            placeholder="Yeni şifreyi tekrar gir"
          />

          {error && <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

          <button
            type="submit"
            disabled={loading || !sessionReady}
            className="w-full rounded-2xl bg-slate-950 px-6 py-3.5 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
          </button>
        </form>
      </div>
    </main>
  );
}
