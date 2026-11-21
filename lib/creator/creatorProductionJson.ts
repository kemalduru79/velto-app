export class CreatorProductionJsonError extends Error {
  constructor() {
    super("CREATOR_PRODUCTION_MODEL_JSON_INVALID");
    this.name = "CreatorProductionJsonError";
  }
}

function extractJsonObject(raw: string) {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  return firstBrace === -1 || lastBrace < firstBrace
    ? cleaned
    : cleaned.slice(firstBrace, lastBrace + 1);
}

function normalizeHarmlessJsonTypography(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

export function parseCreatorProductionJson(raw: string): unknown {
  const extracted = extractJsonObject(raw);

  for (const candidate of [extracted, normalizeHarmlessJsonTypography(extracted)]) {
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new CreatorProductionJsonError();
      }
      return parsed;
    } catch (error) {
      if (error instanceof CreatorProductionJsonError) throw error;
    }
  }

  throw new CreatorProductionJsonError();
}
