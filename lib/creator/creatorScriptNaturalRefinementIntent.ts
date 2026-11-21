/**
 * Conservative natural-language target inference for CreatorLab's single refinement field.
 * This is presentation-level intent classification, NOT authorization or evidence validation.
 * The server continues to enforce scope/mode, owner/revision and whole-script gates.
 */
export type CreatorScriptNaturalRefinementIntent =
  | { status: "empty" }
  | { status: "clarify"; reason: "conflicting_targets" | "selection_required" }
  | { status: "ready"; scope: "selection" | "opening" | "whole_script"; mode: "focused_edit" | "editorial_rewrite" | "research_backed_rewrite" };

export function resolveCreatorScriptNaturalRefinementIntent(
  instruction: string,
  hasSelectedPassage: boolean,
): CreatorScriptNaturalRefinementIntent {
  const value = instruction.toLowerCase().replace(/\u0307/gu, "").trim();
  if (!value) return { status: "empty" };

  // These are conservative hints, not an LLM understanding of arbitrary instructions.
  // Non-opening targets become whole-script proposals, never a silent opening edit.
  const whole = /\b(?:whole|entire|full)\s+(?:script|screenplay|narrative)\b|\b(?:all sections|throughout the script|across the script)\b|(?:tüm|bütün)\s+(?:metni|senaryoyu|bölümleri)|(?:senaryonun|metnin)\s+tamam(?:ını|ı|ında)/iu.test(value);
  const opening = /\b(?:opening|intro(?:duction)?|hook|first paragraph|first section)\b|açılış(?:ı|ını|ta|taki)?|giriş(?:i|ini|te|teki)?|ilk\s+(?:paragraf(?:ı)?|bölüm(?:ü)?)/iu.test(value);
  const excludedOpening = /\b(?:do not|don't|without|except|leave|keep)\s+(?:(?:change|edit|rewrite|touch|modify|alter)\s+)?(?:(?:the|my)\s+)?(?:opening|intro(?:duction)?|hook|first paragraph|first section)\b|(?:açılışı|girişi|ilk\s+(?:paragrafı|bölümü))\s+(?:değiştirme|koru|elleme)/iu.test(value);
  const other = /\b(?:section\s*\d+|(?:second|third|fourth|fifth|last|final|middle)\s+(?:section|paragraph|chapter)|conclusion|ending|finale|body|middle section)\b|(?:\d+\.?\s*bölüm|ikinci\s+bölüm|üçüncü\s+bölüm|sonuç|kapanış|son\s+(?:bölüm|paragraf))/iu.test(value);
  const selectedWords = /\bselected\s+(?:text|passage|paragraph)\b|seçili\s+(?:metin|bölüm|paragraf)|seçtiğim\s+(?:metin|kısım|bölüm)/iu.test(value);

  // Positive requests to find or introduce research need the research-backed path.
  // Negated constraints ("without adding new sources") are not positive requests.
  const positiveResearch = /\b(?:with|using)\s+(?:new|additional|fresh)\s+(?:research|evidence|sources?|studies)\b|\b(?:find|add|introduce|look up|research|investigate)\s+(?:(?:new|additional|more|recent|verified|supporting)\s+){0,3}(?:sources?|studies|research|evidence|statistics|facts)\b|(?:yeni|ek|güncel)\s+(?:kaynak|araştırma|kanıt|istatistik|bilgi)\s+(?:bul|ekle|araştır)|(?:kaynak|araştırma|kanıt|istatistik)\s+(?:ekle|bul|tara)/iu.test(value);
  const negativeResearch = /\b(?:don't|do not|without|never|no)\s+(?:add(?:ing)?|introduc(?:e|ing)|new|extra|additional)\s+(?:(?:new|additional|more|verified)\s+){0,2}(?:sources?|studies|research|evidence|statistics|facts)\b|(?:yeni|ek)\s+(?:kaynak|araştırma|kanıt|istatistik|bilgi)\s+ekleme/iu.test(value);
  const requiresResearch = positiveResearch && !negativeResearch;

  if (selectedWords && !hasSelectedPassage) return { status: "clarify", reason: "selection_required" };
  if ((opening && !excludedOpening && (whole || other)) ||
      (hasSelectedPassage && (whole || other || (opening && !excludedOpening)))) {
    return { status: "clarify", reason: "conflicting_targets" };
  }
  if (hasSelectedPassage && !requiresResearch) return { status: "ready", scope: "selection", mode: "focused_edit" };
  if (opening && !excludedOpening && !requiresResearch) return { status: "ready", scope: "opening", mode: "focused_edit" };

  // Ambiguous, broad, non-opening or research-changing requests use the separately
  // gated whole-script route. A user asking for the ending must NOT get an opening edit.
  return {
    status: "ready",
    scope: "whole_script",
    mode: requiresResearch ? "research_backed_rewrite" : "editorial_rewrite",
  };
}

/**
 * Infer a single, explicitly named section for focused editing without requiring
 * the user to highlight text. This is NOT a whole-script authorization bypass.
 * Only exact canonical section spans are eligible; multi-target or broad requests
 * remain on the separately gated full-script route.
 */
export function inferCreatorScriptFocusedSectionSelection(
  instruction: string,
  sections: readonly { kind: "opening" | "body" | "conclusion"; text: string }[],
  canonicalDocument: string,
): { start: number; end: number; text: string; sectionIndex: number } | null {
  const input = instruction.toLowerCase().replace(/\u0307/gu, "").trim();
  if (!input || sections.length < 2) return null;
  if (sections.map((section) => section.text).join("\n\n") !== canonicalDocument) return null;

  // An instruction naming multiple sections or the whole document must not be
  // transformed into a selection edit, even when one section is also mentioned.
  if (/\b(?:whole|entire|full)\s+(?:script|screenplay|narrative)\b|\b(?:all sections|throughout the script|across the script)\b|(?:tüm|bütün)\s+(?:metni|senaryoyu|bölümleri)|(?:senaryonun|metnin)\s+tamam(?:ını|ı|ında)/iu.test(input)) return null;
  if (/\b(?:without|except|leave|keep|do not|don't|never)\b|(?:değiştirme|koru|dokunma)/iu.test(input)) return null;
  if (/\b(?:bring|add|find|introduce|search for|include)\s+(?:(?:more|additional|new|recent)\s+)?(?:sources?|studies|research|evidence|facts|statistics|citations?)\b|(?:yeni|ek)\s+(?:kaynak|araştırma|kanıt|istatistik)/iu.test(input)) return null;
  if (/\b(?:and|as well as)\s+(?:the\s+)?(?:body|opening|intro|other\s+sections?)\b|(?:diğer\s+bölümler|ve\s+giriş|ve\s+açılış)/iu.test(input)) return null;

  const conclusionIndex = sections.findIndex((section) => section.kind === "conclusion");
  const rules: Array<{ index: number; pattern: RegExp }> = [
    { index: conclusionIndex, pattern: /\b(?:conclusion|ending|final section|last section|closing question)\b|(?:sonuç|kapanış|son\s+bölüm|final\s+bölüm)/iu },
    { index: 1, pattern: /\b(?:second section|section\s*2)\b|(?:ikinci\s+bölüm|2\.?\s*bölüm)/iu },
    { index: 2, pattern: /\b(?:third section|section\s*3)\b|(?:üçüncü\s+bölüm|3\.?\s*bölüm)/iu },
    { index: 3, pattern: /\b(?:fourth section|section\s*4)\b|(?:dördüncü\s+bölüm|4\.?\s*bölüm)/iu },
  ];
  const matching = rules.filter(({ index, pattern }) => index >= 0 && index < sections.length && pattern.test(input));
  if (matching.length !== 1) return null;
  const index = matching[0].index;
  const section = sections[index];
  if (!section.text.trim()) return null;
  let start = 0;
  for (let cursor = 0; cursor < index; cursor++) start += sections[cursor].text.length + 2;
  const end = start + section.text.length;
  if (canonicalDocument.slice(start, end) !== section.text) return null;
  return { start, end, text: section.text, sectionIndex: index };
}
