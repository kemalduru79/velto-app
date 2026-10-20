const compact = (value: string) => value.replace(/\s+/gu, " ").trim();
const decodeEntities = (value: string) => value
  .replace(/&#(\d+);/gu, (match, digits) => Number(digits) <= 0x10ffff ? String.fromCodePoint(Number(digits)) : match)
  .replace(/&#x([\da-f]+);/giu, (match, digits) => Number.parseInt(digits, 16) <= 0x10ffff ? String.fromCodePoint(Number.parseInt(digits, 16)) : match)
  .replace(/&(?:nbsp|amp|lt|gt|quot|apos);/gu, (match) => ({ "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&apos;": "'" }[match] || match));
const normalizeProseDashes = (value: string) => value.replace(/[‐‑‒–—―]/gu, (dash, offset: number, source: string) => {
  const previousCharacter = Array.from(source.slice(0, offset)).at(-1) ?? "";
  const nextCharacter = Array.from(source.slice(offset + dash.length)).at(0) ?? "";
  return /\p{N}/u.test(previousCharacter) || /\p{N}/u.test(nextCharacter) ? dash : "-";
});

export const normalizeStage4b2VerbatimPassage = (value: string) => compact(normalizeProseDashes(decodeEntities(value)
  .normalize("NFC")
  .replace(/[\u00ad\ufeff]/gu, "")
  .replace(/[‘’‚‛]/gu, "'")
  .replace(/[“”„‟]/gu, "\"")
  .replace(/…/gu, "...")));
