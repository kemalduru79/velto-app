"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getUser();

      if (data.user) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    };

    checkSession();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      <p>Yönlendiriliyor...</p>
    </main>
  );
}