"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useLanguage } from "@/lib/useLanguage";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal/policy";

type Props = { kind: "terms" | "privacy" };

const copy = {
  tr: {
    back: "Velto Studio'ya dön",
    version: "Politika sürümü",
    terms: {
      title: "Kullanım Koşulları",
      intro: "Bu koşullar, geliştirme aşamasındaki Velto Studio hizmetinin kullanımına ilişkin temel ürün kurallarını açıklar.",
      sections: [
        ["Hesap ve yaş modeli", "Hesap oluşturma ve hesap yönetimi 18 yaş ve üzeri yetişkin hesap sahibine yöneliktir. Storyverse genç kullanıcı deneyimi, yetişkin tarafından yönetilen bu hesap altında kullanılabilir. Hesap bilgilerinizin doğruluğundan ve giriş bilgilerinizin güvenliğinden siz sorumlusunuz."],
        ["İçerik ve çıktılar", "Girdiğiniz içerik için gerekli hak ve izinlere sahip olmalısınız. Yapay zekâ ile üretilen sonuçlar hatalı, eksik veya uygunsuz olabilir; yayınlamadan ya da kullanmadan önce sonuçları incelemelisiniz."],
        ["Hizmet sağlayıcıları", "İstediğiniz üretim işlemini gerçekleştirmek için yapılandırılmış üçüncü taraf yapay zekâ, medya ve altyapı hizmetleri kullanılabilir."],
        ["Krediler", "Krediler ürün içindeki kullanım birimleridir. Mevcut kredi kuralları beta dönemindedir ve nihai ticari fiyatlandırma taahhüdü değildir."],
        ["Kabul edilemez kullanım", "Hizmeti yasa dışı faaliyet, başkalarına zarar verme, güvenlik kontrollerini aşma, kötüye kullanım veya başkalarının haklarını ihlal etme amacıyla kullanamazsınız."],
        ["Fikri mülkiyet", "Velto ve hizmet arayüzüne ilişkin haklar saklıdır. Kullanıcı girdileri ve üretilen sonuçlara ilişkin hakların kapsamı, içeriğe ve kullanılan sağlayıcılara göre değişebilir; Velto desteklenmeyen mülkiyet garantileri vermez."],
        ["Beta hizmeti", "Ön sürüm döneminde özellikler, kullanılabilirlik ve bu ürün politikaları değişebilir. Hizmet kesintisiz veya hatasız çalışma garantisi vermez."],
      ],
    },
    privacy: {
      title: "Gizlilik Politikası",
      intro: "Bu politika, Velto Studio'nun mevcut ürün davranışına göre işlediği veri kategorilerini ve temel veri yaşam döngüsünü açıklar.",
      sections: [
        ["İşlenen veriler", "E-posta ve görünen ad gibi hesap tanımlayıcıları; proje girdileri ve içerikleri; medya ve üretim çıktıları; ayrıca hizmetin çalışması ve güvenliği için gerekli operasyonel veriler işlenebilir."],
        ["Üretim sağlayıcıları", "Bir üretim isteğini yerine getirmek için gerekli kullanıcı veya proje içeriği, yapılandırılmış üçüncü taraf yapay zekâ ve medya sağlayıcılarına gönderilebilir. Sağlayıcıların kendi saklama ve hukuki koşulları Velto kaynak kodunun garanti kapsamı dışındadır."],
        ["Saklama ve yaşam döngüsü", "Veriler ürün ve hizmet ihtiyaçlarına göre saklanır; burada sabit bir saklama süresi taahhüt edilmez. Medya Çöp Kutusu geri alınabilir durumdadır ve kalıcı temizleme tamamlanana kadar depolama alanı kullanmaya devam eder. Çöp Kutusu fiziksel silme anlamına gelmez."],
        ["Herkese açık Storyverse paylaşımı", "Paylaşım yalnızca açıkça etkinleştirilen Storyverse projelerinde çalışır ve sınırlı herkese açık görünümü sunar. Paylaşım durdurulduğunda bağlantı çözülmez. CreatorLab projeleri bu paylaşım akışını desteklemez."],
        ["Seçimleriniz", "Gereksiz hassas bilgi girmeyin. Proje paylaşımını durdurabilir, uygun medya öğelerini Çöp Kutusu'na taşıyabilir veya geri yükleyebilirsiniz. Hesap genelinde veri silme bu ürün sürümünde uygulanmamıştır."],
      ],
    },
  },
  en: {
    back: "Return to Velto Studio",
    version: "Policy version",
    terms: {
      title: "Terms of Use",
      intro: "These terms describe the baseline product rules for using the pre-release Velto Studio service.",
      sections: [
        ["Account and age model", "Creating and managing an account is intended for an adult account holder aged 18 or older. The Storyverse youth experience may be used under this adult-managed account. You are responsible for accurate account information and safeguarding your sign-in details."],
        ["Content and outputs", "You must have the rights and permissions needed for content you provide. AI-generated results may be inaccurate, incomplete, or unsuitable; review them before publishing or relying on them."],
        ["Service providers", "Configured third-party AI, media, and infrastructure services may be used to perform the generation operation you request."],
        ["Credits", "Credits are in-product usage units. Current credit rules are part of the beta product and are not a promise of final commercial pricing."],
        ["Prohibited misuse", "You may not use the service for unlawful activity, harm, bypassing security controls, abuse, or infringement of another person's rights."],
        ["Intellectual property", "Rights in Velto and its service interface are reserved. Rights relating to user inputs and generated results may depend on the content and providers involved; Velto does not make unsupported ownership guarantees."],
        ["Beta service", "Features, availability, and these product policies may change during pre-release development. The service is not guaranteed to be uninterrupted or error-free."],
      ],
    },
    privacy: {
      title: "Privacy Policy",
      intro: "This policy explains the categories of data Velto Studio processes and the baseline lifecycle reflected by the current product.",
      sections: [
        ["Data processed", "We may process account identifiers such as email and display name; project inputs and content; media and generation outputs; and operational data needed to run and secure the service."],
        ["Generation providers", "User or project content necessary to fulfill a generation request may be sent to configured third-party AI and media providers. Provider-specific retention and legal terms are outside guarantees made by the Velto source repository."],
        ["Retention and lifecycle", "Data is retained according to product and service needs; this policy does not promise a fixed period. Media in Trash remains recoverable and continues to occupy storage until permanent purge completes. Trash is not physical deletion."],
        ["Public Storyverse sharing", "Sharing works only for Storyverse projects explicitly made public and exposes a bounded public view. After sharing is stopped, the link no longer resolves. CreatorLab projects do not support this sharing flow."],
        ["Your choices", "Avoid entering unnecessary sensitive information. You can stop project sharing and move eligible media to Trash or restore it. Account-wide data deletion is not implemented in this product version."],
      ],
    },
  },
} as const;

export default function PolicyPage({ kind }: Props) {
  const { language, setLanguage } = useLanguage();
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("lang");
    if (requested === "tr" || requested === "en") setLanguage(requested);
  }, [setLanguage]);
  const text = copy[language];
  const policy = text[kind];
  const version = kind === "terms" ? TERMS_VERSION : PRIVACY_VERSION;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <article className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-violet-700">Velto Studio</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{policy.title}</h1>
            <p className="mt-2 text-sm text-slate-500">{text.version}: {version}</p>
          </div>
          <div className="flex rounded-full border border-slate-200 p-1 text-xs font-bold" aria-label="Language">
            {(["tr", "en"] as const).map((locale) => (
              <button key={locale} type="button" onClick={() => setLanguage(locale)} aria-pressed={language === locale} className={`rounded-full px-3 py-1.5 ${language === locale ? "bg-slate-950 text-white" : "text-slate-600"}`}>
                {locale.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-6 leading-7 text-slate-700">{policy.intro}</p>
        <div className="mt-8 space-y-7">
          {policy.sections.map(([heading, body]) => (
            <section key={heading}>
              <h2 className="text-lg font-semibold">{heading}</h2>
              <p className="mt-2 leading-7 text-slate-700">{body}</p>
            </section>
          ))}
        </div>
        <Link href="/" className="mt-10 inline-flex font-semibold text-violet-700 hover:underline">← {text.back}</Link>
      </article>
    </main>
  );
}
