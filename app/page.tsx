import Link from "next/link";
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="text-center space-y-6 px-6">
        <h1 className="text-4xl font-bold">
          🎬 Kendi Filmini Yönet
        </h1>

        <p className="text-lg text-gray-300 max-w-xl">
          Hayal gücünü kullan, karakterini oluştur ve kendi hikayeni başlat.
        </p>

        <Link href="/create">
  <button className="rounded-xl bg-white px-6 py-3 text-lg font-semibold text-black transition hover:scale-105">
    Başla
  </button>
</Link>
      </div>
    </main>
  );
}