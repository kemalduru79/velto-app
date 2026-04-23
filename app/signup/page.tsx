"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSignup = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Lütfen email ve şifre gir.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      const user = data.user;

      if (!user) {
        throw new Error("Kullanıcı oluşturulamadı.");
      }

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email,
      });

      if (profileError) {
        throw new Error(profileError.message);
      }

      const { error: roleError } = await supabase.from("roles").upsert({
        user_id: user.id,
        role: "parent",
      });

      if (roleError) {
        throw new Error(roleError.message);
      }

      setMessage("Kayıt başarılı. Şimdi giriş yapabilirsin.");
      setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch (e: any) {
      setError(e?.message || "Kayıt sırasında hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#050816_0%,_#020617_45%,_#000000_100%)] px-4 py-10 text-white">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/[0.05] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="space-y-2">
          <div className="inline-flex rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-violet-200">
            VELTO
          </div>
          <h1 className="text-3xl font-bold">Kayıt Ol</h1>
          <p className="text-sm text-slate-300">
            Parent hesabını oluştur, sonra Experience Lab akışına geç.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="block text-sm text-slate-300">Email</label>
            <input
              type="email"
              className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@mail.com"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm text-slate-300">Şifre</label>
            <input
              type="password"
              className="w-full rounded-xl border border-gray-700 bg-white p-3 text-black"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Şifren"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200">
              {message}
            </div>
          )}

          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full rounded-xl bg-white px-6 py-3 font-semibold text-black transition hover:scale-[1.01] disabled:opacity-50"
          >
            {loading ? "Kayıt oluşturuluyor..." : "Kayıt Ol"}
          </button>

          <div className="text-center text-sm text-slate-300">
            Zaten hesabın var mı?{" "}
            <Link href="/login" className="font-semibold text-cyan-300 hover:underline">
              Giriş Yap
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}