const UNSAFE_MOTION_PHRASES = [
  /\b(?:slow|dramatic|progressive|rapid)?\s*zoom(?:-|\s)?in\b/gi,
  /\b(?:dramatic|slow|rapid)?\s*push(?:-|\s)?in(?:\s+toward(?:s)?\s+(?:the\s+)?subject)?\b/gi,
  /\bdolly(?:-|\s)?in\b/gi,
  /\bpunch(?:-|\s)?in\b/gi,
  /\bcrop(?:-|\s)?in\b/gi,
  /\btight\s+crop\b/gi,
  /\bextreme\s+close(?:-|\s)?up\b/gi,
  /\bprogressively\s+(?:move|moving)\s+closer\b/gi,
  /\bcamera\s+rushes?\s+toward(?:s)?\s+(?:the\s+)?subject\b/gi,
  /\bdramatic\s+zoom\b/gi,
];

const GENERATED_TEXT_PHRASES = [
  /\bbold\s+text\s+fade(?:-|\s)?in\b/gi,
  /\b(?:text|title|caption|words?)\s+appears?\b/gi,
  /\b(?:bold\s+)?text\s+takeaway\b/gi,
  /\btypography\b/gi,
  /\bwords?\s+on\s+screen\b/gi,
  /\blogo\s+text\b/gi,
  /\bend\s+card\s+text\b/gi,
];

function cleanDirection(value: unknown, replacement: string) {
  let normalized = String(value || "").trim();
  if (!normalized) return "";
  for (const pattern of UNSAFE_MOTION_PHRASES) normalized = normalized.replace(pattern, replacement);
  for (const pattern of GENERATED_TEXT_PHRASES) normalized = normalized.replace(pattern, "strong visual emphasis");
  return normalized
    .replace(/\bending\s+on\s+(?:a\s+)?strong visual emphasis\b/gi, "ending on a strong visual takeaway featuring the subject")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

export function normalizeCreatorVideoMotionDirection(value: unknown) {
  return cleanDirection(value, "subtle parallax and restrained lateral movement");
}

export function normalizeCreatorVideoCameraDirection(value: unknown) {
  return cleanDirection(value, "stable cinematic framing with gentle camera drift");
}

export function buildCreatorVideoProviderPrompt(input: {
  text?: unknown;
  motionHint?: unknown;
  cameraDirection?: unknown;
  emotion?: unknown;
}) {
  const text = String(input.text || "").trim();
  const motion = normalizeCreatorVideoMotionDirection(input.motionHint);
  const camera = normalizeCreatorVideoCameraDirection(input.cameraDirection);
  const emotion = String(input.emotion || "").trim();
  return [
    "Create a polished cinematic motion block from the supplied production image.",
    text ? `Scene context: ${text}` : "",
    motion ? `Motion direction: ${motion}` : "",
    camera ? `Camera direction: ${camera}` : "",
    emotion ? `Emotional tone: ${emotion}` : "",
    "Preserve the exact source-image framing, subject scale, field of view and overall composition throughout the shot.",
    "Animate subjects and environmental details naturally within the existing frame with restrained cinematic movement.",
    "Keep every important subject and edge detail inside frame. Do not zoom in, push in, crop in, digitally enlarge, progressively magnify, or convert the shot into a close-up.",
    "Do not generate on-screen text, captions, subtitles, titles, logos, watermarks, letters, words or typography.",
    "Preserve subject identity and visual continuity. Avoid frozen frames, abrupt morphing and unrelated scene changes.",
  ].filter(Boolean).join(" ");
}
