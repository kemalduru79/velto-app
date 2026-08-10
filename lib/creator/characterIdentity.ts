export const CREATOR_CHARACTER_ID_PREFIX = "creator-char-";

export type CreatorCharacterIdentity = {
  id?: unknown;
};

export type CreatorDialogueSpeakerScene = {
  dialogueSpeakerCharacterId?: unknown;
};

const CREATOR_CHARACTER_ID_PATTERN =
  /^creator-char-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createCreatorCharacterId() {
  return `${CREATOR_CHARACTER_ID_PREFIX}${crypto.randomUUID()}`;
}

export function normalizeCreatorCharacterId(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return CREATOR_CHARACTER_ID_PATTERN.test(normalized) ? normalized : undefined;
}

export function ensureCreatorCharacterIds<
  TCharacter extends CreatorCharacterIdentity,
>(characters: TCharacter[] | null | undefined): Array<TCharacter & { id: string }> {
  const usedIds = new Set<string>();

  return (Array.isArray(characters) ? characters : []).map((character) => {
    const existingId = normalizeCreatorCharacterId(character.id);
    const id = existingId && !usedIds.has(existingId)
      ? existingId
      : createCreatorCharacterId();
    usedIds.add(id);
    return { ...character, id };
  });
}

export function resolveCreatorDialogueSpeaker<
  TCharacter extends CreatorCharacterIdentity,
>({
  speakerCharacterId,
  characters,
}: {
  speakerCharacterId: unknown;
  characters: TCharacter[] | null | undefined;
}): TCharacter | undefined {
  const id = normalizeCreatorCharacterId(speakerCharacterId);
  if (!id || !Array.isArray(characters)) return undefined;

  return characters.find(
    (character) => normalizeCreatorCharacterId(character.id) === id,
  );
}

export function normalizeCreatorDialogueSpeakerCharacterId(
  value: unknown,
  characters: CreatorCharacterIdentity[] | null | undefined,
) {
  const resolved = resolveCreatorDialogueSpeaker({
    speakerCharacterId: value,
    characters,
  });
  return resolved ? normalizeCreatorCharacterId(resolved.id) : undefined;
}
