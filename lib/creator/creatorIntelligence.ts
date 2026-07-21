export type CreatorIntelligenceLocale = "tr" | "en";

type CreatorMetadata = {
  recommendedTitle?: string;
  thumbnailTextIdeas?: string[];
  audiencePromise?: string;
  seoKeywords?: string[];
  hookAlternatives?: string[];
};

type CreatorMentorAnalysis = {
  audienceInsight?: string[];
  hookPatterns?: string[];
};

type CreatorPatternSummary = {
  topTitlePatterns?: string[];
  hookPatterns?: string[];
  opportunityScore?: number;
  competitionLevel?: "low" | "medium" | "high";
  recommendedContentAngle?: string;
};

export type CreatorIntelligenceInput = {
  title: string;
  hook: string;
  format: "short_form" | "youtube_video";
  durationSec: number;
  locale: CreatorIntelligenceLocale;
  metadata?: CreatorMetadata | null;
  mentorAnalysis?: CreatorMentorAnalysis | null;
  patternSummary?: CreatorPatternSummary | null;
};

export type CreatorThumbnailAngle = {
  label: string;
  guidance: string;
  text: string;
};

export type CreatorIntelligenceReport = {
  hookScore: number;
  hookLevel: "needs_work" | "promising" | "strong";
  hookSignals: string[];
  recommendedOpening: string;
  thumbnailAngles: CreatorThumbnailAngle[];
  platformStrategy: string;
  audienceAngle: string;
  marketSignals: string[];
  nextBestAction: string;
};

const clean = (value: unknown) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

const strings = (value: unknown) =>
  Array.isArray(value)
    ? value.map(clean).filter(Boolean)
    : [];

const truncate = (value: string, max = 62) =>
  value.length > max ? `${value.slice(0, Math.max(1, max - 1)).trimEnd()}…` : value;

export function createCreatorIntelligence(
  input: CreatorIntelligenceInput,
): CreatorIntelligenceReport {
  const isTr = input.locale === "tr";
  const title = clean(input.metadata?.recommendedTitle) || clean(input.title);
  const hook =
    strings(input.metadata?.hookAlternatives)[0] ||
    clean(input.hook) ||
    strings(input.mentorAnalysis?.hookPatterns)[0] ||
    title;
  const words = hook.split(/\s+/).filter(Boolean);
  const lowerHook = hook.toLocaleLowerCase(input.locale);
  const signals: string[] = [];
  let score = 28;

  if (words.length >= 4 && words.length <= 14) {
    score += 22;
    signals.push(isTr ? "Açılış kısa ve kolay anlaşılır." : "The opening is concise and clear.");
  } else {
    signals.push(isTr ? "Açılışı 4–14 kelimede netleştir." : "Aim for a clearer 4–14 word opening.");
  }

  if (/[?!]/.test(hook) || /\b(nasıl|neden|ne|why|how|what)\b/i.test(lowerHook)) {
    score += 14;
    signals.push(isTr ? "Merak uyandıran bir soru içeriyor." : "It includes a curiosity-driving question.");
  }

  if (/\d/.test(hook) || /\b(ilk|son|gerçek|bugün|now|first|real|today)\b/i.test(lowerHook)) {
    score += 12;
    signals.push(isTr ? "Somutluk veya zaman baskısı var." : "It adds specificity or urgency.");
  }

  if (/\b(keşfet|öğren|gör|değiş|kazan|discover|learn|see|change|build)\b/i.test(lowerHook)) {
    score += 10;
    signals.push(isTr ? "Net bir değer fiili kullanıyor." : "It uses a clear value verb.");
  }

  if (words.length > 18) {
    score -= 10;
    signals.push(isTr ? "İlk cümle fazla uzun olabilir." : "The first sentence may be too long.");
  }

  const patternScore = Number(input.patternSummary?.opportunityScore || 0);
  if (patternScore >= 65) {
    score += 8;
    signals.push(isTr ? "Araştırma verisi bu açıyı destekliyor." : "Research data supports this angle.");
  }

  score = Math.max(0, Math.min(100, score));
  const hookLevel = score >= 72 ? "strong" : score >= 52 ? "promising" : "needs_work";
  const thumbnailIdeas = strings(input.metadata?.thumbnailTextIdeas);
  const keyPhrase = truncate(thumbnailIdeas[0] || title || hook, 34);
  const contrastText = truncate(thumbnailIdeas[1] || hook, 34);
  const keyword = strings(input.metadata?.seoKeywords)[0] || keyPhrase;

  const thumbnailAngles: CreatorThumbnailAngle[] = [
    {
      label: isTr ? "Sonuç odaklı" : "Outcome-led",
      guidance: isTr
        ? "Tek faydayı, güçlü bir yüz ifadesi veya net sonuç görseliyle göster."
        : "Show one benefit with a decisive result or expression.",
      text: keyPhrase,
    },
    {
      label: isTr ? "Merak kontrastı" : "Curiosity contrast",
      guidance: isTr
        ? "Önce/sonra ya da beklenmedik karşıtlığı tek karede kur."
        : "Use a before/after or unexpected contrast in one frame.",
      text: contrastText,
    },
    {
      label: isTr ? "Kanıt ve konu" : "Proof and topic",
      guidance: isTr
        ? "Anahtar kelimeyi küçük tut; görsel kanıtı başrole al."
        : "Keep the keyword short and let visual proof lead.",
      text: truncate(keyword, 34),
    },
  ];

  const platformStrategy = input.format === "short_form"
    ? isTr
      ? `${input.durationSec} sn için ilk 2 saniyede sonucu söyle; tek fikir ve tek aksiyon çağrısı kullan. Uzun video için en güçlü anı 30–60 sn'lik derin anlatıma genişlet.`
      : `For ${input.durationSec}s, state the payoff in the first two seconds; use one idea and one CTA. Expand the strongest moment into a 30–60 second deeper long-form narrative.`
    : isTr
      ? `YouTube uzun formatında ilk 30 saniyede vaat + kanıt ver; bölümleri görünür tut. Aynı videodan bir problem, bir sonuç ve bir ipucu odaklı kısa kesitler çıkar.`
      : `For YouTube long-form, give the promise and proof in the first 30 seconds and make chapters visible. Cut short clips around one problem, one result, and one tip.`;

  const marketSignals = [
    ...strings(input.patternSummary?.topTitlePatterns).slice(0, 1),
    ...strings(input.patternSummary?.hookPatterns).slice(0, 1),
  ];
  if (input.patternSummary?.competitionLevel) {
    marketSignals.push(
      isTr
        ? `Rekabet seviyesi: ${input.patternSummary.competitionLevel}.`
        : `Competition level: ${input.patternSummary.competitionLevel}.`,
    );
  }

  const audienceAngle =
    clean(input.metadata?.audiencePromise) ||
    strings(input.mentorAnalysis?.audienceInsight)[0] ||
    clean(input.patternSummary?.recommendedContentAngle) ||
    (isTr ? "İzleyicinin net bir fayda görmesini sağla." : "Make the viewer benefit immediately clear.");

  return {
    hookScore: score,
    hookLevel,
    hookSignals: signals.slice(0, 4),
    recommendedOpening: hook,
    thumbnailAngles,
    platformStrategy,
    audienceAngle,
    marketSignals,
    nextBestAction: isTr
      ? "İlk 5 saniyeyi bu hook'a göre kontrol et, ardından tek bir thumbnail açısını seç."
      : "Check the first five seconds against this hook, then choose one thumbnail angle.",
  };
}
