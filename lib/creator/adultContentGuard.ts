export type CreatorAdultLanguage = "tr" | "en";

export type CreatorAdultSceneLike = {
  id?: number;
  text?: string;
  narration?: string;
  dialogue?: string;
  cameraDirection?: string;
  emotion?: string;
  motionHint?: string;
  visualPrompt?: string;
};

export type CreatorAdultCharacterLike = {
  name?: string;
  age?: string;
  appearance?: string;
  outfit?: string;
  accessory?: string;
  personality?: string;
};

export type CreatorAdultPackageLike<
  TScene extends CreatorAdultSceneLike = CreatorAdultSceneLike,
  TCharacter extends CreatorAdultCharacterLike = CreatorAdultCharacterLike,
> = {
  title?: string;
  hook?: string;
  storyPremise?: string;
  characters?: TCharacter[];
  scenes?: TScene[];
};

type AdultSceneOptions = {
  language?: CreatorAdultLanguage;
  isOpeningScene?: boolean;
  allowDialogue?: boolean;
};

type AdultPackageOptions = {
  topic?: string;
  contentType?: string;
  format?: string;
  language?: CreatorAdultLanguage;
  allowDialogue?: boolean;
};

const DIALOGUE_INTENT_PATTERNS = [
  /\b(interview|podcast|conversation|dialogue|dialog|debate|panel|roundtable|role[- ]?play|skit|scripted conversation|character[- ]led|characters? (?:talk|speak)|host\s+(?:and|&)\s+guest|presenter\s+(?:and|&)\s+guest|two[- ]person)\b/i,
  /\b(röportaj|podcast|sohbet|diyalog|konuşma|tartışma|panel|yuvarlak masa|rol yapma|skeç|karakter odaklı|karakterler? konuş|sunucu\s+(?:ve|&)\s+konuk|iki kişilik)\b/i,
];

const CHILD_AUDIENCE_PREFIXES = [
  /^(?:hey|hello|hi)\s+(?:kids|children|young explorers|little ones|boys and girls)[,!:\-–—…\s]*/i,
  /^(?:kids|children|young explorers|little ones|boys and girls)\s*[,!:\-–—…]\s*/i,
  /^(?:merhaba|selam)\s+(?:çocuklar|genç kaşifler|minikler)[,!:\-–—…\s]*/i,
  /^(?:çocuklar|genç kaşifler|minikler)\s*[,!:\-–—…]\s*/i,
];

const CHILDLIKE_OPENING_PREFIXES = [
  /^(?:wait|wow|whoa|guess what)[!,.?:\-–—…\s]*/i,
  /^(?:dur|vay canına|tahmin et)[!,.?:\-–—…\s]*/i,
  /^(?:did you know(?: that)?|can you guess)[,?:\-–—…\s]*/i,
  /^(?:biliyor muydun(?:uz)?(?: ki)?|tahmin edebilir misin(?:iz)?)[,?:\-–—…\s]*/i,
];

const CHILDLIKE_PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\blet(?:'|’)s go on an adventure\b/gi, "Let’s examine what happened"],
  [/\bget ready for an amazing adventure\b/gi, "Here is the story"],
  [/\bhaydi bir maceraya çıkalım\b/gi, "Şimdi konuyu inceleyelim"],
  [/\bharika bir maceraya hazır ol(?:un)?\b/gi, "İşte hikâyenin özü"],
];

function normalizeWhitespace(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function capitalizeOpening(value: string, language: CreatorAdultLanguage) {
  if (!value) return value;

  const firstLetterIndex = value.search(/[A-Za-zÇĞİÖŞÜçğıöşü]/);
  if (firstLetterIndex < 0) return value;

  const first = value[firstLetterIndex];
  const capitalized = language === "tr"
    ? first.toLocaleUpperCase("tr-TR")
    : first.toUpperCase();

  return `${value.slice(0, firstLetterIndex)}${capitalized}${value.slice(firstLetterIndex + 1)}`;
}

export function creatorBriefRequestsDialogue({
  topic,
  contentType,
  format,
}: {
  topic?: unknown;
  contentType?: unknown;
  format?: unknown;
}) {
  const source = [topic, contentType, format]
    .map(normalizeWhitespace)
    .filter(Boolean)
    .join(" ");

  return DIALOGUE_INTENT_PATTERNS.some((pattern) => pattern.test(source));
}

export function sanitizeCreatorAdultSpeech(
  value: unknown,
  options?: {
    language?: CreatorAdultLanguage;
    opening?: boolean;
  },
) {
  const language = options?.language === "tr" ? "tr" : "en";
  let normalized = normalizeWhitespace(value);

  for (const pattern of CHILD_AUDIENCE_PREFIXES) {
    normalized = normalized.replace(pattern, "");
  }

  for (const [pattern, replacement] of CHILDLIKE_PHRASE_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  let convertedDidYouKnow = false;

  if (options?.opening) {
    for (const pattern of CHILDLIKE_OPENING_PREFIXES) {
      const before = normalized;
      normalized = normalized.replace(pattern, "");
      if (
        before !== normalized &&
        /^(?:did you know(?: that)?|biliyor muydun(?:uz)?(?: ki)?)/i.test(before)
      ) {
        convertedDidYouKnow = true;
      }
    }
  }

  normalized = normalized
    .replace(/\?!|!\?/g, "?")
    .replace(/!{2,}/g, "!")
    .replace(/\?{2,}/g, "?")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/^[,.;:!?\-–—…\s]+/, "")
    .trim();

  if (convertedDidYouKnow && /\?$/.test(normalized)) {
    normalized = `${normalized.slice(0, -1).trim()}.`;
  }

  return capitalizeOpening(normalized, language);
}

export function isLegacyStoryverseGuideCharacter(
  character?: CreatorAdultCharacterLike | null,
) {
  if (!character) return false;

  const name = normalizeWhitespace(character.name).toLowerCase();
  if (name !== "joe") return false;

  const source = [
    character.age,
    character.appearance,
    character.outfit,
    character.accessory,
    character.personality,
  ]
    .map(normalizeWhitespace)
    .join(" ")
    .toLowerCase();

  return (
    /\b10(?:-year-old)?\b/.test(source) ||
    source.includes("red baseball cap") ||
    source.includes("rocket logo") ||
    source.includes("childlike proportions") ||
    source.includes("asks simple questions that help children")
  );
}

export function isCreatorSystemNarrator(
  character?: CreatorAdultCharacterLike | null,
) {
  const name = normalizeWhitespace(character?.name).toLowerCase();
  return (
    name === "creatorlab narrator" ||
    name === "creatorlab narrator / brand voice" ||
    name === "creatorlab anlatıcı / marka sesi"
  );
}

export function normalizeCreatorAdultCharacters<
  TCharacter extends CreatorAdultCharacterLike,
>(characters: TCharacter[] | null | undefined): TCharacter[] {
  if (!Array.isArray(characters)) return [];

  return characters.filter(
    (character) =>
      !isLegacyStoryverseGuideCharacter(character) &&
      !isCreatorSystemNarrator(character),
  );
}


function isLegacyCreatorCameraDefault(value: string) {
  return /^clean animated framing with clear focus\.?$/i.test(value);
}

function isLegacyCreatorEmotionDefault(value: string) {
  return /^curious and energetic\.?$/i.test(value);
}

function isLegacyCreatorMotionDefault(value: string) {
  return /^simple animated (?:movement|motion)\.?$/i.test(value);
}

export function normalizeCreatorAdultScene<TScene extends CreatorAdultSceneLike>(
  scene: TScene,
  options?: AdultSceneOptions,
): TScene {
  const language = options?.language === "tr" ? "tr" : "en";
  const opening = Boolean(options?.isOpeningScene);
  const allowDialogue = Boolean(options?.allowDialogue);
  const narration = sanitizeCreatorAdultSpeech(scene.narration, {
    language,
    opening,
  });
  const cleanedDialogue = sanitizeCreatorAdultSpeech(scene.dialogue, {
    language,
    opening,
  });
  const finalNarration = !allowDialogue && !narration && cleanedDialogue
    ? cleanedDialogue
    : narration;
  const finalDialogue = allowDialogue ? cleanedDialogue : "";
  const rawCameraDirection = normalizeWhitespace(scene.cameraDirection);
  const rawEmotion = normalizeWhitespace(scene.emotion);
  const rawMotionHint = normalizeWhitespace(scene.motionHint);

  return {
    ...scene,
    text: sanitizeCreatorAdultSpeech(scene.text, { language, opening }),
    narration: finalNarration,
    dialogue: finalDialogue,
    cameraDirection:
      !rawCameraDirection || isLegacyCreatorCameraDefault(rawCameraDirection)
        ? language === "tr"
          ? "Net konu odağına sahip profesyonel editoryal kadraj."
          : "Professional editorial framing with clear subject focus."
        : rawCameraDirection,
    emotion:
      !rawEmotion || isLegacyCreatorEmotionDefault(rawEmotion)
        ? language === "tr"
          ? "odaklı ve güvenilir"
          : "focused and credible"
        : rawEmotion,
    motionHint:
      !rawMotionHint || isLegacyCreatorMotionDefault(rawMotionHint)
        ? language === "tr"
          ? "Temiz geçişe sahip kontrollü editoryal hareket."
          : "Controlled editorial movement with a clean transition."
        : rawMotionHint,
  } as TScene;
}

export function normalizeCreatorAdultPackage<
  TScene extends CreatorAdultSceneLike,
  TCharacter extends CreatorAdultCharacterLike,
  TPackage extends CreatorAdultPackageLike<TScene, TCharacter>,
>(productionPackage: TPackage, options?: AdultPackageOptions): TPackage {
  const language = options?.language === "tr" ? "tr" : "en";
  const sourceScenes = Array.isArray(productionPackage.scenes)
    ? productionPackage.scenes
    : [];
  const allowDialogue =
    typeof options?.allowDialogue === "boolean"
      ? options.allowDialogue
      : creatorBriefRequestsDialogue({
          topic: options?.topic,
          contentType: options?.contentType,
          format: options?.format,
        });
  const normalizedScenes = sourceScenes.map((scene, index) =>
    normalizeCreatorAdultScene(scene, {
      language,
      isOpeningScene: index === 0,
      allowDialogue,
    }),
  );
  const hookSource =
    productionPackage.hook ||
    normalizedScenes[0]?.narration ||
    productionPackage.title ||
    options?.topic ||
    "";

  return {
    ...productionPackage,
    hook: sanitizeCreatorAdultSpeech(hookSource, {
      language,
      opening: true,
    }),
    characters: normalizeCreatorAdultCharacters(productionPackage.characters),
    scenes: normalizedScenes,
  } as TPackage;
}
