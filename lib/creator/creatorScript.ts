import {
  normalizeScriptPlannerEditorialContext,
  type ScriptPlannerEditorialContext,
} from "../research/scriptPlannerEditorialContext.ts";

export const CREATOR_SCRIPT_VERSION = 1 as const;

export const CREATOR_SCRIPT_GENERATION_PRIORITY_HIERARCHY = [
  "Immutable creator constraints",
  "Grounding, source, and evidence authority",
  "Audience-facing narration contract",
  "Section role and narrative progression",
  "Content richness and global duration",
  "Editorial writing quality",
  "Stylistic polish",
] as const;

export const CREATOR_SCRIPT_AUDIENCE_NARRATOR_CONTRACT = [
  "Speak directly to the viewer about the subject and advance the inquiry itself.",
  "Perform the editorial behavior without describing the editorial method, production process, section purpose, brand mission, or internal instructions.",
  "Explain grounded evidence and uncertainty naturally; never address an editor or discuss the audience as an object of content strategy.",
  "Never announce the content plan or production intent with phrases such as 'we will explore', 'we will investigate', 'we will examine', 'this inquiry', or 'our exploration'; perform the inquiry directly in audience-facing narration.",
  "Never make a deictic editorial container such as 'this inquiry', 'this exploration', 'this investigation', or 'this analysis' the acting subject of spoken narration. State the substantive tension, finding, or question directly.",
  "Do not refer to the script, section, episode, documentary, video, content, production, or narrative container when describing this work; do not announce what the content will do, and perform the reasoning directly. Ordinary references to a documentary, video, or document that is itself part of the subject remain valid.",
  "Source identity and provenance are backstage grounding metadata, not narration authority. Narratable concepts must come from creator-provided subject matter or the supplied claim and evidence passages; never paraphrase a source's publishing philosophy or research process into spoken narration.",
  "Do not invent or canonize named methods, frameworks, studies, institutions, theories, systems, practices, or factual authorities absent from creator input or grounded source authority.",
] as const;

export const CREATOR_SCRIPT_DOCUMENTARY_WRITING_CONTRACT = [
  "Write as an intelligent, calm, precise, curious human documentary narrator: state substantive ideas directly instead of announcing, labeling, or explaining the paragraph's function.",
  "Treat established premises as known. Do not restate a thesis merely to transition, summarize prior sections, or give each section a self-contained introduction; each section must add new role-owned intellectual value.",
  "Let transitions emerge from unresolved logic. Never use meta transitions such as 'this brings us to', 'having established', 'we now turn to', 'the next question is', or 'this section examines'.",
  "Prefer concrete grounded human stakes before abstract category lists, but never invent people, scenarios, study details, facts, examples, or authorities. Clearly illustrative language is allowed only when it asserts no new fact and existing grounded evidence cannot provide the concrete stake.",
  "When the section owns evidence or a case, narrate the supported action, observation, comparison, or result before interpreting why it tests the mechanism; do not default to generic 'studies show' or 'evidence suggests' summaries when concrete grounded detail is available.",
  "Vary sentence and paragraph rhythm naturally: combine earned short emphasis with clear medium explanation and occasional longer analysis; avoid repetitive clause shapes, excessive semicolons, rhetorical-question stacking, and mechanically balanced paragraphs.",
  "Avoid academic or generic AI filler that merely restates a point, including repeated uses of 'it is important to', 'this highlights', 'this underscores', 'recognizing this', 'understanding this', 'in this context', 'at its core', 'ultimately', 'profound implications', or 'complex interplay'. These expressions are not banned when they perform necessary substantive work.",
  "For an opening, begin from a grounded human contradiction, recognizable experience, supported surprising fact, consequential tension, or concise observation; avoid generic 'Imagine...' framing, dictionary definitions, question stacking, clickbait, and premature explanation of the full thesis.",
  "For a conclusion, state directly what the established argument changes about identity, agency, responsibility, or meaning; do not label the ending, refer to evidence 'discussed above', recap sections, or narrate the production process. Preserve uncertainty and make the final sentence one natural open question.",
] as const;

export const CREATOR_SCRIPT_FIRST_PASS_BUDGET_CONTRACT = [
  "Before returning JSON, count the spoken words in each authored section against its supplied minWords, targetWords, and maxWords.",
  "Aim near targetWords and do not stop materially below minWords while grounded, section-owned explanation, evidence, uncertainty, comparison, or human consequence remains undeveloped.",
  "Grounding, narration safety, section ownership, and documentary quality outrank local length guidance. Never reach a word target by repeating established premises, summarizing the section, adding filler, or inventing unsupported material.",
] as const;

export type CreatorScriptNarrationSafetyViolation = {
  sectionId: string;
  category: "internal_editorial_leakage" | "unsupported_named_authority";
  marker: string;
  matchText?: string;
  matchStart?: number;
  matchEnd?: number;
};

export type CreatorScriptSectionKind = "opening" | "body" | "conclusion";

export type CreatorScriptSection = {
  id: string;
  kind: CreatorScriptSectionKind;
  heading?: string;
  text: string;
  claimIds: string[];
  evidenceReviewRequired: boolean;
  humanVerification?: { scriptRevision: number; verifiedAt: string };
};

export type CreatorScriptGrounding = {
  context: ScriptPlannerEditorialContext;
};

export type CreatorScriptApproval = {
  approvedRevision: number;
  approvedStrategyFingerprint: string;
  approvedAt: string;
};

export type CreatorScript = {
  version: typeof CREATOR_SCRIPT_VERSION;
  title: string;
  sections: CreatorScriptSection[];
  targetDurationSec: number;
  strategyFingerprint: string;
  revision: number;
  grounding: CreatorScriptGrounding;
  generatedAt: string;
  updatedAt: string;
  approval: CreatorScriptApproval | null;
};

export type CreatorScriptStatus = "draft" | "approved" | "stale";
export type CreatorScriptDurationStatus = "compliant" | "too_short" | "too_long";

export const CREATOR_SCRIPT_MIN_DURATION_RATIO = 0.9;
export const CREATOR_SCRIPT_MAX_DURATION_RATIO = 1.1;

export type CreatorScriptDurationContract = {
  targetDurationSec: number;
  wordsPerSecond: number;
  targetWordCount: number;
  minimumAcceptableWordCount: number;
  maximumAcceptableWordCount: number;
  actualWordCount: number;
  estimatedDurationSec: number;
  varianceSec: number;
  durationRatio: number;
  status: CreatorScriptDurationStatus;
};

export type CreatorScriptSectionBudget = {
  id: string;
  kind: CreatorScriptSectionKind;
  role: string;
  centralQuestion: string;
  progression: string;
  ownershipBoundary: {
    usage: "control_only_never_narrate";
    owns: string[];
    excludes: string[];
  };
  minimumWords: number;
  targetWords: number;
  maximumWords: number;
};

export type CreatorScriptSectionDiagnostic = CreatorScriptSectionBudget & {
  actualWords: number;
  deficitWords: number;
  excessWords: number;
  missing: boolean;
};

export type CreatorScriptExpansionTarget = {
  sectionId: string;
  currentWords: number;
  requestedGainWords: number;
  maxAdditionalWords: number;
  role: string;
  centralQuestion: string;
  progressionFromPrevious: string;
  ownershipBoundary: CreatorScriptSectionBudget["ownershipBoundary"];
  availablePlacementAnchors: Array<{ id: "before_terminal_sentence"; placementMode: "server_exact_offset" }>;
};

export const CREATOR_SCRIPT_MIN_ATOMIC_ADDITIVE_GAIN_WORDS = 20;

export function createCreatorScriptNarrationControlPlan(plan: CreatorScriptSectionBudget[]) {
  const establishedPremises: string[] = [];
  return plan.map((section) => {
    const owns = [...section.ownershipBoundary.owns];
    const narrationDirective = section.kind === "opening"
      ? "Begin directly with one grounded human tension or observation. Ask at most one essential question. Do not announce what the inquiry or content will do."
      : section.kind === "conclusion"
        ? "State directly what the established argument changes about identity, agency, responsibility, or meaning. Preserve uncertainty and make the final sentence the single open question without labeling it."
        : owns.includes("grounded_demonstration")
          ? "Use supported material in this order: what happened or was observed, what result changed, and why that result tests the already-established mechanism. Stop without restating the premise."
          : "Advance only the new substantive work identified by owns. Treat establishedPremises as known; do not define, summarize, or re-teach them.";
    const control = {
      sectionId: section.id,
      kind: section.kind,
      usage: "control_only_never_narrate" as const,
      owns,
      excludes: [...section.ownershipBoundary.excludes],
      establishedPremises: [...establishedPremises],
      narrationDirective,
    };
    establishedPremises.push(...owns);
    return control;
  });
}

export function createCreatorScriptInsertionAnchors(section: Pick<CreatorScriptSection, "text">) {
  const starts = [0];
  for (const match of section.text.matchAll(/[.!?][”"']?\s+(?=\S)/gu)) {
    starts.push((match.index ?? 0) + match[0].length);
  }
  const offset = starts.at(-1) ?? 0;
  return offset > 0 && offset < section.text.length
    ? [{ id: "before_terminal_sentence" as const, placementMode: "server_exact_offset" as const, offset }]
    : [];
}

export function createCreatorScriptAdditiveExpansionPlan(input: {
  script: CreatorScript;
  plan: CreatorScriptSectionBudget[];
  globalDeficitWords: number;
}) {
  const diagnostics = getCreatorScriptSectionDiagnostics(input.script, input.plan);
  const sectionById = new Map(input.script.sections.map((section) => [section.id, section]));
  const ranked = diagnostics
    .filter((section) => section.kind === "body")
    .concat(diagnostics.filter((section) => section.kind === "opening"))
    .concat(diagnostics.filter((section) => section.kind === "conclusion"))
    .map((section) => ({
      section,
      anchors: createCreatorScriptInsertionAnchors(sectionById.get(section.id)!),
      capacity: Math.max(0, section.maximumWords - section.actualWords),
    }))
    .filter((item) => item.capacity > 0 && item.anchors.length > 0);
  const allocations = new Map(ranked.map((item) => [item.section.id, 0]));
  let remaining = Math.max(0, Math.floor(input.globalDeficitWords));
  if (remaining > 0 && remaining <= CREATOR_SCRIPT_MIN_ATOMIC_ADDITIVE_GAIN_WORDS) {
    const atomicTarget = ranked.find((item) =>
      item.section.kind === "body" &&
      item.capacity >= CREATOR_SCRIPT_MIN_ATOMIC_ADDITIVE_GAIN_WORDS
    );
    if (!atomicTarget) return [];
    allocations.set(
      atomicTarget.section.id,
      CREATOR_SCRIPT_MIN_ATOMIC_ADDITIVE_GAIN_WORDS,
    );
    remaining = 0;
  }
  for (const kind of ["body", "opening", "conclusion"] as const) {
    const tier = ranked.filter((item) => item.section.kind === kind);
    while (remaining > 0) {
      let progressed = false;
      for (const item of tier) {
        const allocated = allocations.get(item.section.id) || 0;
        if (allocated >= item.capacity) continue;
        allocations.set(item.section.id, allocated + 1);
        remaining -= 1;
        progressed = true;
        if (remaining === 0) break;
      }
      if (!progressed) break;
    }
    if (remaining === 0) break;
  }
  if (remaining > 0) return [];
  return ranked.flatMap(({ section, anchors, capacity }): CreatorScriptExpansionTarget[] => {
    const requestedGainWords = allocations.get(section.id) || 0;
    return requestedGainWords > 0 ? [{
      sectionId: section.id,
      currentWords: section.actualWords,
      requestedGainWords,
      maxAdditionalWords: capacity,
      role: section.role,
      centralQuestion: section.centralQuestion,
      progressionFromPrevious: section.progression,
      ownershipBoundary: section.ownershipBoundary,
      availablePlacementAnchors: anchors.map(({ id, placementMode }) => ({ id, placementMode })),
    }] : [];
  });
}

export type CreatorScriptValidatedExpansionCandidate<T = unknown> = {
  sectionId: string;
  gainWords: number;
  value: T;
};

export function selectCreatorScriptExpansionCandidates<T>(input: {
  deficitWords: number;
  candidates: CreatorScriptValidatedExpansionCandidate<T>[];
  canonicalSectionOrder: string[];
}) {
  const deficitWords = Math.max(0, Math.floor(input.deficitWords));
  const order = new Map(input.canonicalSectionOrder.map((sectionId, index) => [sectionId, index]));
  const candidates = input.candidates
    .filter((candidate) => candidate.gainWords > 0 && order.has(candidate.sectionId))
    .sort((left, right) => (order.get(left.sectionId) ?? 0) - (order.get(right.sectionId) ?? 0));
  const totalGain = candidates.reduce((sum, candidate) => sum + candidate.gainWords, 0);
  if (deficitWords <= 0) return [];
  if (totalGain < deficitWords) return candidates;

  let selected: typeof candidates | null = null;
  let selectedGain = Number.POSITIVE_INFINITY;
  for (let mask = 1; mask < 2 ** candidates.length; mask += 1) {
    const subset = candidates.filter((_, index) => (mask & (1 << index)) !== 0);
    const gain = subset.reduce((sum, candidate) => sum + candidate.gainWords, 0);
    if (gain < deficitWords) continue;
    const overshoot = gain - deficitWords;
    const selectedOvershoot = selectedGain - deficitWords;
    let canonicalOrderWins = false;
    if (selected !== null && subset.length === selected.length) {
      for (let index = 0; index < subset.length; index += 1) {
        const candidateIndex = order.get(subset[index].sectionId) ?? 0;
        const selectedIndex = order.get(selected[index].sectionId) ?? Number.POSITIVE_INFINITY;
        if (candidateIndex === selectedIndex) continue;
        canonicalOrderWins = candidateIndex < selectedIndex;
        break;
      }
    }
    const better = selected === null
      || overshoot < selectedOvershoot
      || (overshoot === selectedOvershoot && subset.length < selected.length)
      || (overshoot === selectedOvershoot && subset.length === selected.length
        && canonicalOrderWins);
    if (better) {
      selected = subset;
      selectedGain = gain;
    }
  }
  return selected || [];
}

export function applyCreatorScriptAdditiveExpansion(input: {
  section: CreatorScriptSection;
  placementAnchorId: string;
  additionalText: string;
}) {
  const anchors = createCreatorScriptInsertionAnchors(input.section);
  const matches = anchors.filter((anchor) => anchor.id === input.placementAnchorId);
  if (matches.length !== 1) throw new Error("CREATOR_SCRIPT_EXPANSION_ANCHOR_INVALID");
  const additionalText = clean(input.additionalText, 20_000);
  if (!additionalText) throw new Error("CREATOR_SCRIPT_EXPANSION_TEXT_REQUIRED");
  const offset = matches[0].offset;
  const insertedText = `${additionalText} `;
  const text = `${input.section.text.slice(0, offset)}${insertedText}${input.section.text.slice(offset)}`;
  const insertion = { start: offset, end: offset + insertedText.length };
  if (`${text.slice(0, insertion.start)}${text.slice(insertion.end)}` !== input.section.text) {
    throw new Error("CREATOR_SCRIPT_EXPANSION_IMMUTABILITY_FAILED");
  }
  return { text, insertion, insertedText };
}

export class CreatorScriptDurationUnsatisfiedError extends Error {
  code = "CREATOR_SCRIPT_DURATION_UNSATISFIED" as const;
  diagnostics: CreatorScriptDurationContract;

  constructor(diagnostics: CreatorScriptDurationContract) {
    super("The generated script could not safely satisfy the requested duration.");
    this.name = "CreatorScriptDurationUnsatisfiedError";
    this.diagnostics = diagnostics;
  }
}

export class CreatorScriptDurationInvalidError extends Error {
  code = "CREATOR_SCRIPT_DURATION_INVALID" as const;

  constructor() {
    super("A valid target duration between 5 and 3600 seconds is required.");
    this.name = "CreatorScriptDurationInvalidError";
  }
}

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const clean = (value: unknown, maxLength = 100_000) =>
  typeof value === "string"
    ? value.replace(/\r\n/g, "\n").trim().slice(0, maxLength)
    : "";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createCreatorStrategyFingerprint(input: Record<string, unknown>) {
  const canonical = JSON.stringify(canonicalize(input));
  return `creator-strategy-v1-${fnv1a(canonical)}-${canonical.length}`;
}

function normalizeSection(
  value: unknown,
  index: number,
  allowedClaimIds: Set<string>,
): CreatorScriptSection {
  const section = record(value);
  const id = clean(section?.id, 120);
  const kind = section?.kind;
  const text = clean(section?.text, 80_000);
  if (!section || !id || !text || !["opening", "body", "conclusion"].includes(String(kind))) {
    throw new Error(`CREATOR_SCRIPT_SECTION_INVALID:${index + 1}`);
  }
  const claimIds = Array.isArray(section.claimIds)
    ? [...new Set(section.claimIds.map((item) => clean(item, 300)).filter(Boolean))]
    : [];
  const unknownClaim = claimIds.find((claimId) => !allowedClaimIds.has(claimId));
  if (unknownClaim) throw new Error(`CREATOR_SCRIPT_CLAIM_UNKNOWN:${id}:${unknownClaim}`);
  return {
    id,
    kind: kind as CreatorScriptSectionKind,
    ...(clean(section.heading, 300) ? { heading: clean(section.heading, 300) } : {}),
    text,
    claimIds,
    evidenceReviewRequired: section.evidenceReviewRequired === true,
    ...(record(section.humanVerification) && Number(record(section.humanVerification)?.scriptRevision) > 0 && clean(record(section.humanVerification)?.verifiedAt, 100)
      ? { humanVerification: { scriptRevision: Number(record(section.humanVerification)?.scriptRevision), verifiedAt: clean(record(section.humanVerification)?.verifiedAt, 100) } }
      : {}),
  };
}

export function normalizeCreatorScript(value: unknown): CreatorScript {
  const script = record(value);
  const grounding = record(script?.grounding);
  let editorialContext: ScriptPlannerEditorialContext | null = null;
  try {
    editorialContext = normalizeScriptPlannerEditorialContext(grounding?.context);
  } catch {
    editorialContext = null;
  }
  if (!script || script.version !== CREATOR_SCRIPT_VERSION || !editorialContext) {
    throw new Error("CREATOR_SCRIPT_INVALID");
  }
  const allowedClaimIds = new Set(editorialContext.claims.map((claim) => claim.claimId));
  if (!Array.isArray(script.sections) || script.sections.length < 3 || script.sections.length > 24) {
    throw new Error("CREATOR_SCRIPT_SECTIONS_INVALID");
  }
  const claimById = new Map(editorialContext.claims.map((claim) => [claim.claimId, claim]));
  const primarySourceCoveredClaimIds = new Set(
    editorialContext.readiness.primarySourceCoveredClaimIds,
  );
  const rawSections = script.sections.map((section, index) => {
    const normalized = normalizeSection(section, index, allowedClaimIds);
    return {
      ...normalized,
      evidenceReviewRequired: normalized.evidenceReviewRequired || normalized.claimIds.some(
        (claimId) => {
          const claim = claimById.get(claimId);
          return (claim?.supportingEvidenceIds.length || 0) === 0 ||
            (claim?.claimType === "PRIMARY_SOURCE_CLAIM" &&
              !primarySourceCoveredClaimIds.has(claimId));
        },
      ),
    };
  });
  if (rawSections[0]?.kind !== "opening" || rawSections.at(-1)?.kind !== "conclusion" || rawSections.slice(1, -1).some((section) => section.kind !== "body")) {
    throw new Error("CREATOR_SCRIPT_STRUCTURE_INVALID");
  }
  if (new Set(rawSections.map((section) => section.id)).size !== rawSections.length) {
    throw new Error("CREATOR_SCRIPT_SECTION_ID_DUPLICATE");
  }
  const approval = script.approval === null ? null : record(script.approval);
  if (approval && (
    !Number.isInteger(approval.approvedRevision) || Number(approval.approvedRevision) < 1 ||
    !clean(approval.approvedStrategyFingerprint, 300) || !clean(approval.approvedAt, 100)
  )) throw new Error("CREATOR_SCRIPT_APPROVAL_INVALID");
  const targetDurationSec = Number(script.targetDurationSec);
  const revision = Number(script.revision);
  if (!clean(script.title, 500) || !Number.isFinite(targetDurationSec) || targetDurationSec <= 0 || !Number.isInteger(revision) || revision < 1 || !clean(script.strategyFingerprint, 300) || !clean(script.generatedAt, 100) || !clean(script.updatedAt, 100)) {
    throw new Error("CREATOR_SCRIPT_FIELDS_INVALID");
  }
  const sections = rawSections.map((section) => {
    const verificationValid = !section.evidenceReviewRequired && section.humanVerification?.scriptRevision === revision;
    return verificationValid ? section : { ...section, humanVerification: undefined };
  });
  return {
    version: CREATOR_SCRIPT_VERSION,
    title: clean(script.title, 500),
    sections,
    targetDurationSec,
    strategyFingerprint: clean(script.strategyFingerprint, 300),
    revision,
    grounding: { context: editorialContext },
    generatedAt: clean(script.generatedAt, 100),
    updatedAt: clean(script.updatedAt, 100),
    approval: approval ? {
      approvedRevision: Number(approval.approvedRevision),
      approvedStrategyFingerprint: clean(approval.approvedStrategyFingerprint, 300),
      approvedAt: clean(approval.approvedAt, 100),
    } : null,
  };
}

export function assertCreatorScriptVerificationAuthority(persisted: CreatorScript, candidate: CreatorScript) {
  const previousById = new Map(persisted.sections.map((section) => [section.id, section]));
  for (const section of candidate.sections) {
    const previous = previousById.get(section.id);
    if (!previous) continue;
    if (section.humanVerification && JSON.stringify(section.humanVerification) !== JSON.stringify(previous.humanVerification)) {
      throw new Error("CREATOR_SCRIPT_VERIFICATION_FORGED");
    }
    const sameLineage = candidate.generatedAt === persisted.generatedAt;
    const bindingsUnchanged = JSON.stringify(section.claimIds) === JSON.stringify(previous.claimIds);
    if (sameLineage && previous.evidenceReviewRequired && !section.evidenceReviewRequired && section.text === previous.text && bindingsUnchanged) {
      throw new Error("CREATOR_SCRIPT_VERIFICATION_FORGED");
    }
    if (sameLineage && section.text !== previous.text && section.claimIds.length > 0 && !section.evidenceReviewRequired) {
      throw new Error("CREATOR_SCRIPT_VERIFICATION_FORGED");
    }
  }
  return candidate;
}

export function isValidCreatorScript(value: unknown): value is CreatorScript {
  try {
    normalizeCreatorScript(value);
    return true;
  } catch {
    return false;
  }
}

export function createCreatorScript(input: Omit<CreatorScript, "version" | "revision" | "approval"> & { revision?: number }): CreatorScript {
  return normalizeCreatorScript({ ...input, version: CREATOR_SCRIPT_VERSION, revision: input.revision ?? 1, approval: null });
}

export function getCreatorScriptStatus(script: CreatorScript, currentStrategyFingerprint: string): CreatorScriptStatus {
  if (script.strategyFingerprint !== currentStrategyFingerprint) return "stale";
  return script.approval && script.approval.approvedRevision === script.revision && script.approval.approvedStrategyFingerprint === script.strategyFingerprint
    ? "approved"
    : "draft";
}

export function getCreatorScriptWordsPerSecond(language: "tr" | "en") {
  return language === "tr" ? 2.15 : 2.35;
}

export function validateCreatorScriptGenerationDuration(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 5 || value > 3600) {
    throw new CreatorScriptDurationInvalidError();
  }
  return value;
}

export function countCreatorScriptWords(value: string) {
  return value.replace(/[“”"'’.,!?;:()\[\]{}]/g, " ").trim().split(/\s+/).filter(Boolean).length;
}

function normalizeCreatorScriptAuthorityText(value: string) {
  return value.normalize("NFKC").replace(/[’‘]/gu, "'").replace(/\s+/gu, " ").trim().toLocaleLowerCase();
}

export function createCreatorScriptNarrationAuthority(input: {
  editorialContext: ScriptPlannerEditorialContext;
  creatorProvidedText?: unknown[];
}) {
  const narrationContext = createCreatorScriptNarrationEditorialContext(input.editorialContext);
  const creatorProvided = (input.creatorProvidedText || []).flatMap((value) => {
    if (typeof value === "string") return [value];
    try { return [JSON.stringify(value)]; } catch { return []; }
  });
  const grounded = [
    ...narrationContext.claims.map((claim) => claim.text),
    ...narrationContext.evidence.flatMap((evidence) => [evidence.excerpt || "", evidence.contextNote || ""]),
  ];
  return normalizeCreatorScriptAuthorityText([...creatorProvided, ...grounded].filter(Boolean).join("\n"));
}

/**
 * Source identity and classification establish provenance backstage. They do
 * not, by themselves, authorize the narrator to speak a source's brand,
 * publishing philosophy, or research process. A source identity is speakable
 * only when it is also present in an allowlisted claim or evidence passage.
 */
export function createCreatorScriptNarrationEditorialContext(
  context: ScriptPlannerEditorialContext,
): ScriptPlannerEditorialContext {
  const controlOnlySourceIds = new Set(context.sources
    .filter((source) => {
      try {
        const url = new URL(source.url);
        return /(^|\.)thnkfirst\.com$/iu.test(url.hostname)
          && /^\/applied-inquiry(?:\/|$)/iu.test(url.pathname);
      } catch {
        return false;
      }
    })
    .map((source) => source.sourceId));
  const evidence = context.evidence.filter((item) => !controlOnlySourceIds.has(item.sourceId));
  const narrationEvidenceIds = new Set(evidence.map((item) => item.evidenceId));
  const claims = context.claims
    .map((claim) => ({
      ...claim,
      supportingEvidenceIds: claim.supportingEvidenceIds.filter((id) => narrationEvidenceIds.has(id)),
      counterEvidenceIds: claim.counterEvidenceIds.filter((id) => narrationEvidenceIds.has(id)),
      contextualEvidenceIds: claim.contextualEvidenceIds.filter((id) => narrationEvidenceIds.has(id)),
    }))
    .filter((claim) => [
      ...claim.supportingEvidenceIds,
      ...claim.counterEvidenceIds,
      ...claim.contextualEvidenceIds,
    ].length > 0);
  const narrationSourceIds = new Set(evidence.map((item) => item.sourceId));
  return {
    ...context,
    editorialConstitution: "Backstage editorial controls are enforced separately and are not narration material.",
    claims,
    evidence,
    sources: context.sources.filter((source) => narrationSourceIds.has(source.sourceId)).map((source) => ({
      sourceId: source.sourceId,
      title: "Grounding source",
      url: "",
      publisher: "",
      author: null,
      publishedAt: null,
      directness: source.directness,
      reviewStatus: source.reviewStatus,
      searchLane: source.searchLane,
      sourceKind: source.sourceKind,
    })),
  };
}

export function getCreatorScriptNarrationSafetyViolations(input: {
  sections: Array<Pick<CreatorScriptSection, "id" | "text">>;
  authoritativeText: string;
}) {
  const violations: CreatorScriptNarrationSafetyViolation[] = [];
  const internalPatterns: Array<{ marker: string; pattern: RegExp }> = [
    { marker: "publishing_brand", pattern: /\bTHYNEL\b/giu },
    { marker: "invalid_named_internal_artifact", pattern: /\bTHNK\s+Research\b/giu },
    { marker: "production_intent_meta", pattern: /\b(?:(?:this|our)\s+(?:inquiry|exploration|investigation|analysis))\s+(?:(?:does\s+not\s+|does\s+|will\s+)?(?:seek|aim|offer|provide|create|open|allow|ask|invite|frame|introduce|explore|examine|reveal|show)s?)\b/giu },
    { marker: "narrative_process_meta", pattern: /\bwe\s+(?:will|aim\s+to|seek\s+to)\s+(?:investigate|explore|examine|consider)\b/giu },
    {
      marker: "production_self_reference",
      pattern: /\b(?:(?:(?:in|within|later\s+in|earlier\s+in)\s+(?:this|our)\s+(?:script|documentary|episode|video|section|content|production|narrative))|(?:(?:this|our)\s+(?:script|documentary|episode|video|section|content|production|narrative)\s*,?\s*(?:we\s+(?:will|aim\s+to|seek\s+to)|will|aims?\s+to|seeks?\s+to|explores?|examines?|investigates?|considers?|shows?|reveals?|asks?|argues?|traces?|focuses?)))\b/giu,
    },
    { marker: "editorial_methodology", pattern: /\b(?:our|the|this)\s+editorial\s+(?:approach|method|methodology|commitment|mission|purpose)\b/giu },
    { marker: "editorial_methodology", pattern: /\b(?:the\s+)?(?:working\s+)?inquiry\s+(?:practice|approach|method(?:ology)?)\s+behind\s+(?:this|our)\s+(?:exploration|inquiry|investigation|analysis)\b/giu },
    { marker: "editorial_methodology", pattern: /\bthis\s+(?:understanding|perspective|view)\s+aligns?\s+with\s+(?:the\s+)?(?:principle|practice|approach)\s+that\s+inquiry\b/giu },
    { marker: "editorial_alignment", pattern: /\b(?:this inquiry|this project|this story)\s+(?:aligns?|reflects?|embodies?|supports?)\b/giu },
    { marker: "audience_as_strategy", pattern: /\b(?:we|this (?:documentary|inquiry))\s+(?:invite|ask|encourage)\s+(?:the\s+)?(?:viewer|viewers|audience)\b/giu },
  ];
  const namedAuthorityPatterns = [
    /\b[\p{Lu}][\p{L}\p{N}&.'’-]*(?:\s+[\p{Lu}][\p{L}\p{N}&.'’-]*){0,4}\s+(?:Research|Methodology|Method|Framework|Theory|Institute|Institution|University|Laboratory|Lab|Study|System|Practice)\b/gu,
    /\b[\p{Lu}][\p{L}\p{N}&.'’-]*(?:\s+[\p{Lu}][\p{L}\p{N}&.'’-]*){0,4}\s+(?:Araştırma(?:sı)?|Yöntemi|Metodolojisi|Çerçevesi|Teorisi|Enstitüsü|Kurumu|Üniversitesi|Laboratuvarı|Çalışması|Sistemi|Uygulaması)\b/gu,
  ];
  for (const section of input.sections) {
    for (const { marker, pattern } of internalPatterns) {
      const match = pattern.exec(section.text);
      if (match) violations.push({
        sectionId: section.id,
        category: "internal_editorial_leakage",
        marker,
        matchText: match[0].slice(0, 120),
        matchStart: match.index,
        matchEnd: match.index + match[0].length,
      });
      pattern.lastIndex = 0;
    }
    for (const pattern of namedAuthorityPatterns) {
      for (const match of section.text.matchAll(pattern)) {
        const candidate = normalizeCreatorScriptAuthorityText(match[0]);
        if (candidate && !input.authoritativeText.includes(candidate)) violations.push({
          sectionId: section.id,
          category: "unsupported_named_authority",
          marker: match[0],
          matchText: match[0].slice(0, 120),
          matchStart: match.index,
          matchEnd: match.index + match[0].length,
        });
      }
    }
  }
  return violations;
}

export function assertCreatorScriptNarrationIsProductionSafe(input: {
  sections: Array<Pick<CreatorScriptSection, "id" | "text">>;
  authoritativeText: string;
}) {
  const violations = getCreatorScriptNarrationSafetyViolations(input);
  if (violations.length > 0) {
    console.warn("CREATOR_SCRIPT_NARRATION_SAFETY_DIAGNOSTICS", {
      violations: violations.map((violation) => ({
        sectionId: violation.sectionId,
        category: violation.category,
        marker: violation.marker,
        matchText: violation.matchText,
        matchStart: violation.matchStart,
        matchEnd: violation.matchEnd,
      })),
    });
  }
  if (violations.some((violation) => violation.category === "internal_editorial_leakage")) throw new Error("CREATOR_SCRIPT_NARRATION_EDITORIAL_LEAKAGE");
  if (violations.length) throw new Error("CREATOR_SCRIPT_NARRATION_UNSUPPORTED_NAMED_AUTHORITY");
  return input.sections;
}

export function getCreatorScriptDurationContract(input: {
  targetDurationSec: number;
  language: "tr" | "en";
  actualWordCount: number;
}): CreatorScriptDurationContract {
  const targetDurationSec = Number(input.targetDurationSec);
  const actualWordCount = Number(input.actualWordCount);
  if (!Number.isFinite(targetDurationSec) || targetDurationSec <= 0 || !Number.isInteger(actualWordCount) || actualWordCount < 0) {
    throw new Error("CREATOR_SCRIPT_DURATION_INPUT_INVALID");
  }
  const wordsPerSecond = getCreatorScriptWordsPerSecond(input.language);
  const targetWordCount = Math.round(targetDurationSec * wordsPerSecond);
  const minimumAcceptableWordCount = Math.ceil(targetWordCount * CREATOR_SCRIPT_MIN_DURATION_RATIO);
  const maximumAcceptableWordCount = Math.floor(targetWordCount * CREATOR_SCRIPT_MAX_DURATION_RATIO);
  const estimatedDurationSec = Math.round((actualWordCount / wordsPerSecond) * 10) / 10;
  const varianceSec = Math.round((estimatedDurationSec - targetDurationSec) * 10) / 10;
  const durationRatio = Math.round((estimatedDurationSec / targetDurationSec) * 1000) / 1000;
  const status: CreatorScriptDurationStatus = actualWordCount < minimumAcceptableWordCount
    ? "too_short"
    : actualWordCount > maximumAcceptableWordCount
      ? "too_long"
      : "compliant";
  return {
    targetDurationSec,
    wordsPerSecond,
    targetWordCount,
    minimumAcceptableWordCount,
    maximumAcceptableWordCount,
    actualWordCount,
    estimatedDurationSec,
    varianceSec,
    durationRatio,
    status,
  };
}

export function getCreatorScriptDurationContractForScript(script: CreatorScript, language: "tr" | "en") {
  return getCreatorScriptDurationContract({
    targetDurationSec: script.targetDurationSec,
    language,
    actualWordCount: countCreatorScriptWords(script.sections.map((section) => section.text).join("\n\n")),
  });
}

export function createCreatorScriptSectionBudgetPlan(input: {
  targetDurationSec: number;
  language: "tr" | "en";
  hasMaterialCounterview?: boolean;
}) {
  const duration = getCreatorScriptDurationContract({
    targetDurationSec: input.targetDurationSec,
    language: input.language,
    actualWordCount: 0,
  });
  const bodyCount = Math.max(1, Math.min(10, Math.round(duration.targetWordCount / 375)));
  const weights = [0.08, ...Array.from({ length: bodyCount }, () => 0.82 / bodyCount), 0.1];
  const targets = weights.map((weight) => Math.floor(duration.targetWordCount * weight));
  targets[targets.length - 1] += duration.targetWordCount - targets.reduce((sum, value) => sum + value, 0);
  const longForm = duration.targetWordCount > getCreatorScriptSafeSingleCallTargetWords();
  const bodyFunctions: Array<Pick<CreatorScriptSectionBudget, "role" | "centralQuestion" | "progression" | "ownershipBoundary">> = [
    {
      role: "Define and frame the phenomenon precisely",
      centralQuestion: "What exactly counts as the phenomenon, what does not, and which familiar framing needs correction?",
      progression: "Converts the opening tension into a precise subject the rest of the argument can explain.",
      ownershipBoundary: { usage: "control_only_never_narrate", owns: ["definition", "framing", "misconception_correction"], excludes: ["opening_thesis_restatement", "mechanism", "evidence", "social_formation", "material_consequence"] },
    },
    {
      role: "Explain the central mechanism or causal process",
      centralQuestion: "How does the phenomenon actually work, step by step?",
      progression: "Adds causal explanation rather than restating that the phenomenon exists.",
      ownershipBoundary: { usage: "control_only_never_narrate", owns: ["mechanism", "causal_process"], excludes: ["evidence_catalog", "limits", "social_formation", "material_consequence"] },
    },
    {
      role: "Demonstrate the mechanism through the strongest grounded evidence or case",
      centralQuestion: "What concrete evidence, case, or observation demonstrates whether the proposed mechanism operates as described?",
      progression: "Moves from explaining the process to showing what grounded evidence demonstrates it.",
      ownershipBoundary: { usage: "control_only_never_narrate", owns: ["grounded_demonstration", "concrete_case"], excludes: ["mechanism_reteaching", "limits", "social_formation", "material_consequence"] },
    },
    input.hasMaterialCounterview
      ? {
          role: "Present and seriously test the strongest evidence-backed counterview or alternative explanation",
          centralQuestion: "What is the strongest credible challenge to the emerging thesis, and what survives it?",
          progression: "Introduces genuine tension and limits instead of token balance language.",
          ownershipBoundary: { usage: "control_only_never_narrate", owns: ["counterview", "thesis_stress_test"], excludes: ["mechanism_summary", "evidence_summary", "social_formation", "material_consequence"] },
        }
      : {
          role: "Examine limits, uncertainty, and where the explanation may break down",
          centralQuestion: "What remains uncertain, conditional, or resistant to the main explanation?",
          progression: "Tests the thesis without inventing an unsupported opposing claim.",
          ownershipBoundary: { usage: "control_only_never_narrate", owns: ["limits", "uncertainty", "scope_conditions"], excludes: ["mechanism_summary", "evidence_summary", "social_formation", "material_consequence"] },
        },
    {
      role: "Explain social, relational, or systemic formation and influence",
      centralQuestion: "How do interactions, shared narratives, institutions, or culture shape or reinforce the phenomenon?",
      progression: "Moves from individual limits to how the phenomenon is formed or altered through social and systemic interaction.",
      ownershipBoundary: { usage: "control_only_never_narrate", owns: ["social_formation", "relational_influence", "systemic_interaction"], excludes: ["downstream_harm", "decision_outcome", "legal_outcome", "material_consequence"] },
    },
    {
      role: "Develop material downstream consequences and second-order effects",
      centralQuestion: "What materially happens in lives, decisions, institutions, responsibility, or outcomes when the phenomenon is believed or acted upon?",
      progression: "Builds on formation and influence by tracing supported downstream effects rather than explaining how the phenomenon was formed.",
      ownershipBoundary: { usage: "control_only_never_narrate", owns: ["material_consequence", "downstream_effect", "second_order_impact"], excludes: ["social_formation_reteaching", "mechanism_reteaching", "evidence_summary"] },
    },
    {
      role: "Examine the personal, moral, or existential consequence",
      centralQuestion: "What does this change about agency, responsibility, identity, or meaning?",
      progression: "Brings the established argument to its deepest human implication.",
      ownershipBoundary: { usage: "control_only_never_narrate", owns: ["human_implication"], excludes: ["section_recap", "conclusion_synthesis"] },
    },
    {
      role: "Reconcile competing interpretations without flattening their disagreement",
      centralQuestion: "Which competing interpretation best fits the evidence, and what cannot be reconciled?",
      progression: "Synthesizes established tensions while preserving material uncertainty.",
      ownershipBoundary: { usage: "control_only_never_narrate", owns: ["interpretation_reconciliation"], excludes: ["supporting_section_reteaching"] },
    },
    {
      role: "Apply the argument to a distinct practical or future-facing consequence",
      centralQuestion: "Where does this argument lead when decisions or future conditions change?",
      progression: "Extends the argument into a new supported domain rather than paraphrasing it.",
      ownershipBoundary: { usage: "control_only_never_narrate", owns: ["distinct_application"], excludes: ["prior_consequence_duplication"] },
    },
    {
      role: "Identify the final unresolved tension before synthesis",
      centralQuestion: "What decisive question remains unanswered after the evidence is weighed?",
      progression: "Creates the unresolved tension that the conclusion must honestly carry forward.",
      ownershipBoundary: { usage: "control_only_never_narrate", owns: ["unresolved_tension"], excludes: ["conclusion_synthesis", "argument_recap"] },
    },
  ];
  const selectedBodyFunctions = bodyFunctions.slice(0, bodyCount);
  if (
    input.hasMaterialCounterview
    && selectedBodyFunctions.length > 0
    && !selectedBodyFunctions.some((item) => item.role.includes("counterview"))
  ) {
    selectedBodyFunctions[selectedBodyFunctions.length - 1] = bodyFunctions[3];
  }
  return targets.map((targetWords, index): CreatorScriptSectionBudget => {
    const kind: CreatorScriptSectionKind = index === 0
      ? "opening"
      : index === targets.length - 1
        ? "conclusion"
        : "body";
    const bodyFunction = selectedBodyFunctions[Math.max(0, index - 1)] ?? bodyFunctions.at(-1)!;
    return {
      id: kind === "body" ? `section-${index}` : kind,
      kind,
      role: kind === "opening"
        ? "Establish the master question, stakes, and selected hook"
        : kind === "conclusion"
          ? "Derive the highest-order implication for the master question, preserve uncertainty, and end on one unresolved question"
          : longForm ? bodyFunction.role : `Develop grounded documentary argument ${index}`,
      centralQuestion: kind === "opening"
        ? "What question and stakes should make the audience need the answer?"
        : kind === "conclusion"
          ? "What highest-order implication does the established argument create for the master question, and what single unresolved question follows from that implication?"
          : longForm ? bodyFunction.centralQuestion : `What distinct part of the argument belongs in section ${index}?`,
      progression: kind === "opening"
        ? "Creates unresolved audience stakes before definition, mechanism, and evidence are introduced."
        : kind === "conclusion"
          ? "Moves forward from established consequences to their deepest implication for the master question rather than tracing backward through the section sequence."
          : longForm ? bodyFunction.progression : "Advances the narrative beyond the previous section.",
      ownershipBoundary: kind === "opening"
        ? { usage: "control_only_never_narrate", owns: ["human_stakes", "master_tension", "master_question"], excludes: ["full_definition", "mechanism", "evidence", "limits", "social_formation", "material_consequence"] }
        : kind === "conclusion"
          ? { usage: "control_only_never_narrate", owns: ["highest_order_implication", "synthesis_for_master_question", "unresolved_question"], excludes: ["definition", "mechanism", "evidence_demonstration", "limits_inventory", "social_formation", "consequence_inventory", "section_by_section_recap"] }
          : longForm ? bodyFunction.ownershipBoundary : { usage: "control_only_never_narrate", owns: ["distinct_argument_step"], excludes: ["neighboring_section_repetition"] },
      minimumWords: Math.floor(targetWords * CREATOR_SCRIPT_MIN_DURATION_RATIO),
      targetWords,
      maximumWords: Math.ceil(targetWords * CREATOR_SCRIPT_MAX_DURATION_RATIO),
    };
  });
}

export function getCreatorScriptSectionDiagnostics(
  script: CreatorScript,
  plan: CreatorScriptSectionBudget[],
) {
  const sectionById = new Map(script.sections.map((section) => [section.id, section]));
  return plan.map((budget): CreatorScriptSectionDiagnostic => {
    const section = sectionById.get(budget.id);
    const actualWords = section ? countCreatorScriptWords(section.text) : 0;
    return {
      ...budget,
      actualWords,
      deficitWords: Math.max(0, budget.minimumWords - actualWords),
      excessWords: Math.max(0, actualWords - budget.maximumWords),
      missing: !section,
    };
  });
}

const CREATOR_SCRIPT_HEADING_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "behind", "by", "for", "from",
  "how", "in", "into", "is", "it", "its", "of", "on", "or", "that", "the",
  "their", "this", "to", "what", "when", "where", "why", "with", "ve", "bir",
  "bu", "da", "de", "icin", "ile", "mi", "mı", "mu", "mü", "nasıl", "neden",
]);

function creatorScriptHeadingTokens(value: unknown) {
  return clean(value, 300)
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/u)
    .map((token) => token.endsWith("ies") && token.length > 4
      ? `${token.slice(0, -3)}y`
      : token.endsWith("s") && token.length > 4
        ? token.slice(0, -1)
        : token)
    .filter((token) => token.length > 1 && !CREATOR_SCRIPT_HEADING_STOP_WORDS.has(token));
}

export function getCreatorScriptEditorialDistinctivenessFailures(
  script: CreatorScript,
  plan: CreatorScriptSectionBudget[],
) {
  const failureIds = new Set(
    getCreatorScriptEditorialDistinctivenessDiagnostics(script, plan)
      .map((failure) => failure.sectionId),
  );
  return plan.filter((section) => failureIds.has(section.id));
}

export function createCreatorScriptDistinctivenessRepairContext(
  script: CreatorScript,
  plan: CreatorScriptSectionBudget[],
) {
  const sectionById = new Map(script.sections.map((section) => [section.id, section]));
  return getCreatorScriptEditorialDistinctivenessDiagnostics(script, plan).map((failure) => ({
    sectionId: failure.sectionId,
    comparedSectionId: failure.comparedSectionId ?? null,
    failureType: failure.failureType,
    overlapRatio: failure.overlapRatio ?? null,
    meaningfulHeadingTokenCount: failure.meaningfulHeadingTokenCount,
    currentHeading: sectionById.get(failure.sectionId)?.heading || "",
    comparedHeading: failure.comparedSectionId
      ? sectionById.get(failure.comparedSectionId)?.heading || ""
      : null,
  }));
}

export type CreatorScriptEditorialDistinctivenessDiagnostic = {
  sectionId: string;
  comparedSectionId?: string;
  failureType: "heading_insufficient_distinct_tokens" | "heading_token_overlap";
  role: string;
  meaningfulHeadingTokenCount: number;
  overlapRatio?: number;
};

export function getCreatorScriptEditorialDistinctivenessDiagnostics(
  script: CreatorScript,
  plan: CreatorScriptSectionBudget[],
): CreatorScriptEditorialDistinctivenessDiagnostic[] {
  assertCreatorScriptMatchesSectionPlan(script, plan);
  const bodySections = script.sections.filter((section) => section.kind === "body");
  const budgetById = new Map(plan.map((section) => [section.id, section]));
  const failures: CreatorScriptEditorialDistinctivenessDiagnostic[] = [];
  for (let index = 0; index < bodySections.length; index += 1) {
    const section = bodySections[index];
    const tokens = new Set(creatorScriptHeadingTokens(section.heading));
    if (tokens.size < 2) failures.push({
      sectionId: section.id,
      failureType: "heading_insufficient_distinct_tokens",
      role: budgetById.get(section.id)?.role || "",
      meaningfulHeadingTokenCount: tokens.size,
    });
    for (let priorIndex = 0; priorIndex < index; priorIndex += 1) {
      const prior = bodySections[priorIndex];
      const priorTokens = new Set(creatorScriptHeadingTokens(prior.heading));
      const smallerSize = Math.min(tokens.size, priorTokens.size);
      if (smallerSize < 2) continue;
      const intersection = [...tokens].filter((token) => priorTokens.has(token)).length;
      const overlapRatio = intersection / smallerSize;
      if (overlapRatio >= 0.72) failures.push({
        sectionId: section.id,
        comparedSectionId: prior.id,
        failureType: "heading_token_overlap",
        role: budgetById.get(section.id)?.role || "",
        meaningfulHeadingTokenCount: tokens.size,
        overlapRatio,
      });
    }
  }
  return failures;
}

export function assertCreatorScriptHasDistinctEditorialSections(
  script: CreatorScript,
  plan: CreatorScriptSectionBudget[],
) {
  if (getCreatorScriptEditorialDistinctivenessFailures(script, plan).length > 0) {
    throw new Error("CREATOR_SCRIPT_EDITORIAL_DISTINCTIVENESS_UNSATISFIED");
  }
  return script;
}

export function assertCreatorScriptMatchesSectionPlan(
  script: CreatorScript,
  plan: CreatorScriptSectionBudget[],
) {
  if (
    script.sections.length !== plan.length
    || script.sections.some((section, index) => section.id !== plan[index]?.id || section.kind !== plan[index]?.kind)
  ) throw new Error("CREATOR_SCRIPT_SECTION_PLAN_MISMATCH");
  return script;
}

export function assertCreatorScriptSatisfiesSectionBudgets(
  script: CreatorScript,
  plan: CreatorScriptSectionBudget[],
) {
  assertCreatorScriptMatchesSectionPlan(script, plan);
  if (getCreatorScriptSectionDiagnostics(script, plan).some((section) =>
    section.missing || section.deficitWords > 0 || section.excessWords > 0
  )) throw new Error("CREATOR_SCRIPT_SECTION_BUDGET_UNSATISFIED");
  return script;
}

export function getCreatorScriptMaterialSectionFailures(
  script: CreatorScript,
  plan: CreatorScriptSectionBudget[],
) {
  const localVariance = Math.max(
    1 - CREATOR_SCRIPT_MIN_DURATION_RATIO,
    CREATOR_SCRIPT_MAX_DURATION_RATIO - 1,
  );
  return getCreatorScriptSectionDiagnostics(script, plan).filter((section) => {
    const materialMinimumWords = Math.floor(section.targetWords * (1 - (localVariance * 2)));
    const materialMaximumWords = Math.ceil(section.targetWords * (1 + (localVariance * 2)));
    return section.missing
      || section.actualWords === 0
      || section.actualWords < materialMinimumWords
      || section.actualWords > materialMaximumWords;
  });
}

export function getCreatorScriptDurationRepairSections(input: {
  script: CreatorScript;
  plan: CreatorScriptSectionBudget[];
  duration: CreatorScriptDurationContract;
}) {
  const diagnostics = getCreatorScriptSectionDiagnostics(input.script, input.plan);
  if (input.duration.status === "compliant") {
    const materialIds = new Set(
      getCreatorScriptMaterialSectionFailures(input.script, input.plan)
        .map((section) => section.id),
    );
    return diagnostics.filter((section) => materialIds.has(section.id));
  }

  const expanding = input.duration.status === "too_short";
  const primary = diagnostics.filter((section) => expanding
    ? section.actualWords < section.minimumWords
    : section.actualWords > section.maximumWords);
  const selectedIds = new Set(primary.map((section) => section.id));
  const selected = [...primary];
  const residualWords = expanding
    ? input.duration.minimumAcceptableWordCount - input.duration.actualWordCount
    : input.duration.actualWordCount - input.duration.maximumAcceptableWordCount;
  const capacity = (section: CreatorScriptSectionDiagnostic) => expanding
    ? Math.max(0, section.maximumWords - section.actualWords)
    : Math.max(0, section.actualWords - section.minimumWords);
  let controlledCapacity = selected.reduce((sum, section) => sum + capacity(section), 0);

  if (controlledCapacity < residualWords) {
    const additional = diagnostics
      .filter((section) => !selectedIds.has(section.id) && capacity(section) > 0)
      .sort((left, right) => capacity(right) - capacity(left));
    for (const section of additional) {
      selected.push(section);
      controlledCapacity += capacity(section);
      if (controlledCapacity >= residualWords) break;
    }
  }

  return controlledCapacity >= residualWords ? selected : [];
}

export function createCreatorScriptRepairTargets(input: {
  sections: CreatorScriptSectionDiagnostic[];
  direction: "expand" | "compress" | "rebalance_sections" | "differentiate_sections";
}) {
  return input.sections.map((section) => ({
    sectionId: section.id,
    direction: input.direction,
    beforeWords: section.actualWords,
    requiredFinalMinWords: section.minimumWords,
    requiredFinalTargetWords: section.targetWords,
    requiredFinalMaxWords: section.maximumWords,
    minimumRequiredGain: input.direction === "expand"
      ? Math.max(0, section.minimumWords - section.actualWords)
      : 0,
    minimumRequiredReduction: input.direction === "compress"
      ? Math.max(0, section.actualWords - section.maximumWords)
      : 0,
  }));
}

export function assertCreatorScriptHasHealthySectionStructure(
  script: CreatorScript,
  plan: CreatorScriptSectionBudget[],
) {
  assertCreatorScriptMatchesSectionPlan(script, plan);
  if (getCreatorScriptMaterialSectionFailures(script, plan).length > 0) {
    throw new Error("CREATOR_SCRIPT_SECTION_BUDGET_UNSATISFIED");
  }
  return script;
}

export function assertCreatorScriptHasSafeSectionStructure(
  script: CreatorScript,
  plan: CreatorScriptSectionBudget[],
) {
  assertCreatorScriptMatchesSectionPlan(script, plan);
  if (getCreatorScriptSectionDiagnostics(script, plan).some((section) =>
    section.missing || section.actualWords === 0 || section.excessWords > 0
  )) throw new Error("CREATOR_SCRIPT_SECTION_BUDGET_UNSATISFIED");
  return script;
}

export function filterCreatorScriptRepairReplacements(input: {
  script: CreatorScript;
  plan: CreatorScriptSectionBudget[];
  replacements: unknown[];
}) {
  return getCreatorScriptRepairReplacementDiagnostics(input)
    .filter((diagnostic) => diagnostic.accepted)
    .map((diagnostic) => diagnostic.replacement);
}

export function getCreatorScriptRepairReplacementDiagnostics(input: {
  script: CreatorScript;
  plan: CreatorScriptSectionBudget[];
  replacements: unknown[];
}) {
  assertCreatorScriptMatchesSectionPlan(input.script, input.plan);
  const diagnostics = new Map(
    getCreatorScriptSectionDiagnostics(input.script, input.plan)
      .map((section) => [section.id, section]),
  );
  return input.replacements.map((value) => {
    const item = record(value);
    const id = clean(item?.id, 120);
    const diagnostic = diagnostics.get(id);
    if (!diagnostic) return { sectionId: id || "unknown", beforeWords: null, candidateWords: null, accepted: false, reason: "unknown_section", replacement: value };
    const replacementWords = countCreatorScriptWords(clean(item?.text, 100_000));
    if (replacementWords === 0) return { sectionId: id, beforeWords: diagnostic.actualWords, candidateWords: replacementWords, accepted: false, reason: "empty", replacement: value };
    if (replacementWords > diagnostic.maximumWords) return { sectionId: id, beforeWords: diagnostic.actualWords, candidateWords: replacementWords, accepted: false, reason: "above_maximum", replacement: value };
    if (diagnostic.actualWords < diagnostic.minimumWords && replacementWords <= diagnostic.actualWords) return { sectionId: id, beforeWords: diagnostic.actualWords, candidateWords: replacementWords, accepted: false, reason: "wrong_direction_expand", replacement: value };
    if (diagnostic.actualWords > diagnostic.maximumWords && replacementWords >= diagnostic.actualWords) return { sectionId: id, beforeWords: diagnostic.actualWords, candidateWords: replacementWords, accepted: false, reason: "wrong_direction_compress", replacement: value };
    const reason = diagnostic.actualWords < diagnostic.minimumWords && replacementWords < diagnostic.minimumWords
      ? "partial_progress_requires_retry"
      : "accepted_within_section_envelope";
    return { sectionId: id, beforeWords: diagnostic.actualWords, candidateWords: replacementWords, accepted: true, reason, replacement: value };
  });
}

export function mergeCreatorScriptReplacementSections(input: {
  script: CreatorScript;
  replacements: unknown;
  plan?: CreatorScriptSectionBudget[];
}) {
  if (!Array.isArray(input.replacements) || input.replacements.length === 0) {
    throw new Error("CREATOR_SCRIPT_REPAIR_SECTIONS_REQUIRED");
  }
  const replacementById = new Map<string, unknown>();
  const allowedIds = input.plan?.map((section) => section.id)
    ?? input.script.sections.map((section) => section.id);
  for (const value of input.replacements) {
    const item = record(value);
    const id = clean(item?.id, 120);
    if (!id || replacementById.has(id) || !allowedIds.includes(id)) {
      throw new Error(`CREATOR_SCRIPT_REPAIR_SECTION_INVALID:${id || "unknown"}`);
    }
    replacementById.set(id, value);
  }
  const existingById = new Map(input.script.sections.map((section) => [section.id, section]));
  const nextRevision = input.script.revision + 1;
  const sections = allowedIds.map((id) => replacementById.get(id) ?? (() => { const section = existingById.get(id); return section?.humanVerification ? { ...section, humanVerification: { ...section.humanVerification, scriptRevision: nextRevision } } : section; })());
  if (sections.some((section) => !section)) {
    throw new Error("CREATOR_SCRIPT_REPAIR_SECTIONS_INCOMPLETE");
  }
  return normalizeCreatorScript({
    ...input.script,
    sections,
    revision: input.script.revision + 1,
    updatedAt: new Date().toISOString(),
    approval: null,
  });
}

export function filterCreatorScriptDistinctiveRepairReplacements(input: {
  script: CreatorScript;
  replacements: unknown[];
  plan: CreatorScriptSectionBudget[];
}) {
  if (input.replacements.length === 0) return {
    replacements: [],
    failures: [] as CreatorScriptEditorialDistinctivenessDiagnostic[],
    rejectedSectionIds: [] as string[],
  };
  const candidate = mergeCreatorScriptReplacementSections(input);
  const failures = getCreatorScriptEditorialDistinctivenessDiagnostics(candidate, input.plan);
  const replacementIds = new Set(input.replacements.map((replacement) => clean(record(replacement)?.id, 120)));
  const rejectedSectionIds = new Set<string>();
  for (const failure of failures) {
    if (replacementIds.has(failure.sectionId)) rejectedSectionIds.add(failure.sectionId);
    if (failure.comparedSectionId && replacementIds.has(failure.comparedSectionId)) {
      rejectedSectionIds.add(failure.comparedSectionId);
    }
  }
  return {
    replacements: input.replacements.filter((replacement) =>
      !rejectedSectionIds.has(clean(record(replacement)?.id, 120))
    ),
    failures,
    rejectedSectionIds: [...rejectedSectionIds],
  };
}

export function getCreatorScriptOutputTokenBudget(targetWordCount: number) {
  return Math.max(1_500, Math.min(12_000, Math.ceil(targetWordCount * 2.5 + 1_500)));
}

export const CREATOR_SCRIPT_MIN_OUTPUT_TOKENS = 1_500;
export const CREATOR_SCRIPT_JSON_TOKEN_RESERVE = 300;
export const CREATOR_SCRIPT_CONSERVATIVE_TOKENS_PER_WORD = 1.5;
export const CREATOR_SCRIPT_MAX_RESIDUAL_REPAIR_RATIO = 0.12;

export function getCreatorScriptSafeSingleCallTargetWords() {
  return Math.floor(
    (CREATOR_SCRIPT_MIN_OUTPUT_TOKENS - CREATOR_SCRIPT_JSON_TOKEN_RESERVE)
      / CREATOR_SCRIPT_CONSERVATIVE_TOKENS_PER_WORD,
  );
}

export function shouldUseCreatorScriptSectionNativeGeneration(targetWordCount: number) {
  return Number.isFinite(targetWordCount) &&
    targetWordCount > getCreatorScriptSafeSingleCallTargetWords();
}

export function mergeCreatorScriptSectionUnits(input: {
  sections: unknown[];
  plan: CreatorScriptSectionBudget[];
}) {
  if (input.sections.length !== input.plan.length) {
    throw new Error("CREATOR_SCRIPT_SECTION_UNITS_INCOMPLETE");
  }
  return input.plan.map((budget, index) => {
    const sectionValue = input.sections[index];
    const section = record(sectionValue);
    const id = clean(section?.id, 120);
    const kind = clean(section?.kind, 120);
    const role = clean(section?.role, 500);
    if (
      (id && id !== budget.id) ||
      (kind && kind !== budget.kind) ||
      (role && role !== budget.role) ||
      !clean(section?.text, 100_000)
    ) {
      throw new Error(`CREATOR_SCRIPT_SECTION_UNIT_INVALID:${budget.id}`);
    }
    return {
      ...section,
      id: budget.id,
      kind: budget.kind,
      role: budget.role,
    };
  });
}

export async function generateCreatorScriptSectionUnits(input: {
  plan: CreatorScriptSectionBudget[];
  generateSection: (
    section: CreatorScriptSectionBudget,
    index: number,
    completedSections: readonly unknown[],
  ) => Promise<unknown>;
}) {
  const completedSections: unknown[] = [];
  for (const [index, section] of input.plan.entries()) {
    const generated = await input.generateSection(section, index, completedSections);
    const validated = mergeCreatorScriptSectionUnits({
      sections: [generated],
      plan: [section],
    });
    completedSections.push(validated[0]);
  }
  return mergeCreatorScriptSectionUnits({
    sections: completedSections,
    plan: input.plan,
  });
}

export function isCreatorScriptResidualRepairEligible(
  diagnostics: CreatorScriptDurationContract,
) {
  if (diagnostics.status === "compliant") return false;
  const distanceToEnvelope = diagnostics.status === "too_short"
    ? diagnostics.minimumAcceptableWordCount - diagnostics.actualWordCount
    : diagnostics.actualWordCount - diagnostics.maximumAcceptableWordCount;
  return distanceToEnvelope > 0 &&
    distanceToEnvelope <= Math.ceil(
      diagnostics.targetWordCount * CREATOR_SCRIPT_MAX_RESIDUAL_REPAIR_RATIO,
    );
}

export function isCreatorScriptCurrentForStrategy(input: {
  script: CreatorScript | null;
  strategyFingerprint: string;
  targetDurationSec: number;
  language: "tr" | "en";
}) {
  const { script } = input;
  return Boolean(
    script
    && script.strategyFingerprint === input.strategyFingerprint
    && script.targetDurationSec === input.targetDurationSec
  );
}

export async function acceptCreatorScriptWithDurationRepair(input: {
  firstScript: CreatorScript;
  language: "tr" | "en";
  repair: (
    diagnostics: CreatorScriptDurationContract,
    script: CreatorScript,
    attempt: number,
  ) => Promise<CreatorScript>;
  requiresRepair?: (script: CreatorScript) => boolean;
  validateFinal?: (script: CreatorScript) => void;
  allowRepair?: boolean;
  maxRepairAttempts?: number;
  shouldRetryRepair?: (input: {
    previous: CreatorScriptDurationContract;
    current: CreatorScriptDurationContract;
    attempt: number;
  }) => boolean;
}) {
  const firstScript = normalizeCreatorScript(input.firstScript);
  const firstDiagnostics = getCreatorScriptDurationContractForScript(firstScript, input.language);
  if (firstDiagnostics.status === "compliant" && !input.requiresRepair?.(firstScript)) {
    input.validateFinal?.(firstScript);
    return { creatorScript: firstScript, diagnostics: firstDiagnostics, repaired: false };
  }
  if (input.allowRepair === false) {
    throw new CreatorScriptDurationUnsatisfiedError(firstDiagnostics);
  }
  const maxRepairAttempts = Math.max(1, Math.min(2, input.maxRepairAttempts ?? 1));
  let currentScript = firstScript;
  let currentDiagnostics = firstDiagnostics;
  for (let attempt = 1; attempt <= maxRepairAttempts; attempt += 1) {
    const previousDiagnostics = currentDiagnostics;
    currentScript = normalizeCreatorScript(
      await input.repair(previousDiagnostics, currentScript, attempt),
    );
    currentDiagnostics = getCreatorScriptDurationContractForScript(currentScript, input.language);
    if (currentDiagnostics.status === "compliant") {
      input.validateFinal?.(currentScript);
      return {
        creatorScript: currentScript,
        diagnostics: currentDiagnostics,
        repaired: true,
        repairAttempts: attempt,
      };
    }
    if (
      attempt >= maxRepairAttempts
      || !input.shouldRetryRepair?.({
        previous: previousDiagnostics,
        current: currentDiagnostics,
        attempt,
      })
    ) {
      throw new CreatorScriptDurationUnsatisfiedError(currentDiagnostics);
    }
  }
  throw new CreatorScriptDurationUnsatisfiedError(currentDiagnostics);
}

export function creatorScriptRepairMateriallyImproved(input: {
  previous: CreatorScriptDurationContract;
  current: CreatorScriptDurationContract;
}) {
  if (input.previous.status !== input.current.status || input.current.status === "compliant") {
    return false;
  }
  const previousDistance = input.previous.status === "too_short"
    ? input.previous.minimumAcceptableWordCount - input.previous.actualWordCount
    : input.previous.actualWordCount - input.previous.maximumAcceptableWordCount;
  const currentDistance = input.current.status === "too_short"
    ? input.current.minimumAcceptableWordCount - input.current.actualWordCount
    : input.current.actualWordCount - input.current.maximumAcceptableWordCount;
  const improvement = previousDistance - currentDistance;
  // Any strict movement toward the global envelope may use the one remaining
  // bounded attempt. A small partial expansion is progress, not success; the
  // hard duration gate still decides final acceptance after at most two calls.
  return currentDistance > 0 && improvement > 0;
}

export async function generateCreatorScriptWithDurationContract(input: {
  durationSec: unknown;
  language: "tr" | "en";
  generateInitial: (durationSec: number) => Promise<CreatorScript>;
  repair: (
    script: CreatorScript,
    diagnostics: CreatorScriptDurationContract,
    attempt: number,
  ) => Promise<CreatorScript>;
  requiresRepair?: (script: CreatorScript) => boolean;
  validateFinal?: (script: CreatorScript) => void;
  allowRepair?: boolean;
  maxRepairAttempts?: number;
  shouldRetryRepair?: (input: {
    previous: CreatorScriptDurationContract;
    current: CreatorScriptDurationContract;
    attempt: number;
  }) => boolean;
}) {
  const durationSec = validateCreatorScriptGenerationDuration(input.durationSec);
  const firstScript = await input.generateInitial(durationSec);
  return acceptCreatorScriptWithDurationRepair({
    firstScript,
    language: input.language,
    repair: (diagnostics, script, attempt) => input.repair(script, diagnostics, attempt),
    requiresRepair: input.requiresRepair,
    validateFinal: input.validateFinal,
    allowRepair: input.allowRepair,
    maxRepairAttempts: input.maxRepairAttempts,
    shouldRetryRepair: input.shouldRetryRepair,
  });
}

export function getCreatorScriptMetrics(script: CreatorScript, language: "tr" | "en") {
  const fullText = getCreatorScriptDocumentText(script);
  const duration = getCreatorScriptDurationContractForScript(script, language);
  const groundedSections = script.sections.filter((section) => section.claimIds.length > 0).length;
  return { fullText, wordCount: duration.actualWordCount, estimatedDurationSec: duration.estimatedDurationSec, targetDurationSec: script.targetDurationSec, varianceSec: duration.varianceSec, evidenceCoverage: script.sections.length ? groundedSections / script.sections.length : 0 };
}

export function getCreatorScriptDocumentText(script: CreatorScript) {
  return script.sections.map((section) => section.text).join("\n\n");
}

function projectCreatorScriptDocumentSections(script: CreatorScript, documentText: string) {
  const normalizedDocument = clean(documentText, 100_000);
  if (!normalizedDocument) throw new Error("CREATOR_SCRIPT_DOCUMENT_TEXT_REQUIRED");
  const originalDocument = getCreatorScriptDocumentText(script);
  if (normalizedDocument === originalDocument) return script.sections.map((section) => section.text);

  let unchangedPrefixLength = 0;
  while (
    unchangedPrefixLength < originalDocument.length &&
    unchangedPrefixLength < normalizedDocument.length &&
    originalDocument[unchangedPrefixLength] === normalizedDocument[unchangedPrefixLength]
  ) unchangedPrefixLength += 1;
  let unchangedSuffixLength = 0;
  while (
    unchangedSuffixLength < originalDocument.length - unchangedPrefixLength &&
    unchangedSuffixLength < normalizedDocument.length - unchangedPrefixLength &&
    originalDocument[originalDocument.length - unchangedSuffixLength - 1] ===
      normalizedDocument[normalizedDocument.length - unchangedSuffixLength - 1]
  ) unchangedSuffixLength += 1;

  const spans: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const section of script.sections) {
    spans.push({ start: cursor, end: cursor + section.text.length });
    cursor += section.text.length + 2;
  }
  const originalEditStart = unchangedPrefixLength;
  const originalEditEnd = originalDocument.length - unchangedSuffixLength;
  const startSectionIndex = spans.findIndex((span) => originalEditStart <= span.end);
  const endProbe = Math.max(originalEditStart, originalEditEnd);
  let endSectionIndex = spans.findLastIndex((span) => endProbe >= span.start);
  if (startSectionIndex < 0) throw new Error("CREATOR_SCRIPT_DOCUMENT_STRUCTURE_INVALID");
  endSectionIndex = Math.max(startSectionIndex, endSectionIndex);

  const startSpan = spans[startSectionIndex];
  const endSpan = spans[endSectionIndex];
  const replacementEnd = normalizedDocument.length - unchangedSuffixLength;
  const affectedDocument = [
    script.sections[startSectionIndex].text.slice(0, Math.max(0, originalEditStart - startSpan.start)),
    normalizedDocument.slice(originalEditStart, replacementEnd),
    script.sections[endSectionIndex].text.slice(Math.max(0, originalEditEnd - endSpan.start)),
  ].join("");
  const affectedSectionCount = endSectionIndex - startSectionIndex + 1;
  const affectedTexts = affectedSectionCount === 1
    ? [affectedDocument.trim()]
    : affectedDocument.split(/\n\s*\n/).map((text) => text.trim());
  if (affectedTexts.length !== affectedSectionCount || affectedTexts.some((text) => !text)) {
    throw new Error("CREATOR_SCRIPT_DOCUMENT_BOUNDARY_AMBIGUOUS");
  }
  return script.sections.map((section, index) =>
    index < startSectionIndex || index > endSectionIndex
      ? section.text
      : affectedTexts[index - startSectionIndex],
  );
}

export function editCreatorScriptDocument(
  script: CreatorScript,
  documentText: string,
  updatedAt = new Date().toISOString(),
) {
  const sectionTexts = projectCreatorScriptDocumentSections(script, documentText);
  if (sectionTexts.some((text) => !text)) throw new Error("CREATOR_SCRIPT_DOCUMENT_STRUCTURE_INVALID");
  if (sectionTexts.every((text, index) => text === script.sections[index].text)) return script;
  const sections = script.sections.map((section, index) => {
    const changed = section.text !== sectionTexts[index];
    return {
      ...section,
      text: sectionTexts[index],
      evidenceReviewRequired: section.evidenceReviewRequired || (changed && section.claimIds.length > 0),
      ...(changed ? { humanVerification: undefined } : section.humanVerification ? { humanVerification: { ...section.humanVerification, scriptRevision: script.revision + 1 } } : {}),
    };
  });
  return normalizeCreatorScript({
    ...script,
    sections,
    revision: script.revision + 1,
    updatedAt,
    approval: null,
  });
}

export function getCreatorScriptSectionSourceReview(script: CreatorScript, sectionId: string) {
  const section = script.sections.find((item) => item.id === sectionId);
  if (!section || !section.evidenceReviewRequired || script.grounding.context.readiness.status === "blocked") return null;
  const claims = new Map(script.grounding.context.claims.map((claim) => [claim.claimId, claim]));
  const evidence = new Map(script.grounding.context.evidence.map((item) => [item.evidenceId, item]));
  const sources = new Map(script.grounding.context.sources.map((source) => [source.sourceId, source]));
  const items = section.claimIds.map((claimId) => {
    const claim = claims.get(claimId);
    const support = claim?.supportingEvidenceIds.map((id) => evidence.get(id)).filter((item) => item !== undefined).map((item) => ({
      sourceTitle: sources.get(item.sourceId)?.title || "",
      excerpt: item.excerpt,
      context: item.contextNote,
    })).filter((item) => item.sourceTitle && item.excerpt) ?? [];
    return claim && support.length ? { statement: claim.text, sources: support } : null;
  }).filter((item) => item !== null);
  return items.length === section.claimIds.length && items.length > 0 ? { sectionId, items } : null;
}

export function verifyCreatorScriptSectionSources(script: CreatorScript, sectionId: string, verifiedAt = new Date().toISOString()) {
  if (!getCreatorScriptSectionSourceReview(script, sectionId)) throw new Error("CREATOR_SCRIPT_MANUAL_VERIFICATION_UNAVAILABLE");
  return normalizeCreatorScript({
    ...script,
    sections: script.sections.map((section) => section.id === sectionId ? {
      ...section,
      evidenceReviewRequired: false,
      humanVerification: { scriptRevision: script.revision, verifiedAt },
    } : section),
  });
}

export function creatorScriptHasGroundingBlocker(script: CreatorScript) {
  return script.grounding.context.readiness.status === "blocked" || script.sections.some((section) => section.evidenceReviewRequired);
}

export function canBuildScenesFromCreatorScript(script: CreatorScript | null, currentStrategyFingerprint: string) {
  return Boolean(script && getCreatorScriptStatus(script, currentStrategyFingerprint) === "approved" && !creatorScriptHasGroundingBlocker(script));
}

export function acceptGeneratedCreatorScript<TScene>(input: {
  generatedScript: unknown;
  origin: { projectId: string; generation: number };
  active: { projectId: string; generation: number };
  workspaceStep: number;
  scenes: readonly TScene[];
}) {
  if (input.origin.projectId !== input.active.projectId || input.origin.generation !== input.active.generation) {
    return null;
  }
  return {
    script: normalizeCreatorScript(input.generatedScript),
    workspaceStep: input.workspaceStep,
    scenes: input.scenes,
  };
}

export function approveCreatorScript(script: CreatorScript, currentStrategyFingerprint: string, approvedAt = new Date().toISOString()) {
  if (script.strategyFingerprint !== currentStrategyFingerprint) throw new Error("CREATOR_SCRIPT_STALE");
  if (creatorScriptHasGroundingBlocker(script)) throw new Error("CREATOR_SCRIPT_GROUNDING_BLOCKED");
  return normalizeCreatorScript({ ...script, approval: { approvedRevision: script.revision, approvedStrategyFingerprint: script.strategyFingerprint, approvedAt } });
}

export function editCreatorScriptSection(script: CreatorScript, sectionId: string, text: string, updatedAt = new Date().toISOString()) {
  const normalizedText = clean(text, 80_000);
  if (!normalizedText) throw new Error("CREATOR_SCRIPT_SECTION_TEXT_REQUIRED");
  let found = false;
  const sections = script.sections.map((section) => {
    if (section.id !== sectionId) return section.humanVerification ? { ...section, humanVerification: { ...section.humanVerification, scriptRevision: script.revision + 1 } } : section;
    found = true;
    if (section.text === normalizedText) return section;
    return { ...section, text: normalizedText, evidenceReviewRequired: section.claimIds.length > 0, humanVerification: undefined };
  });
  if (!found) throw new Error("CREATOR_SCRIPT_SECTION_NOT_FOUND");
  return normalizeCreatorScript({ ...script, sections, revision: script.revision + 1, updatedAt, approval: null });
}

export function regenerateCreatorScriptSection(script: CreatorScript, sectionId: string, replacement: unknown, updatedAt = new Date().toISOString()) {
  const allowedClaimIds = new Set(script.grounding.context.claims.map((claim) => claim.claimId));
  const currentIndex = script.sections.findIndex((section) => section.id === sectionId);
  if (currentIndex < 0) throw new Error("CREATOR_SCRIPT_SECTION_NOT_FOUND");
  const nextSection = normalizeSection(replacement, currentIndex, allowedClaimIds);
  if (nextSection.id !== sectionId || nextSection.kind !== script.sections[currentIndex].kind) throw new Error("CREATOR_SCRIPT_REGENERATION_TARGET_MISMATCH");
  const sections = script.sections.map((section, index) => index === currentIndex ? { ...nextSection, humanVerification: undefined } : section.humanVerification ? { ...section, humanVerification: { ...section.humanVerification, scriptRevision: script.revision + 1 } } : section);
  return normalizeCreatorScript({ ...script, sections, revision: script.revision + 1, updatedAt, approval: null });
}

const CREATOR_SCRIPT_SENTENCE_ABBREVIATIONS = new Set([
  "dr.", "doç.", "etc.", "mr.", "mrs.", "ms.", "no.", "prof.", "sn.", "st.", "örn.", "vb.", "vd.", "vs.", "yrd.",
]);

function splitCreatorScriptSentences(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const sentences: string[] = [];
  let start = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    const punctuation = normalized[index];
    if (punctuation !== "." && punctuation !== "?" && punctuation !== "!") continue;
    if (punctuation === "." && /\d/.test(normalized[index - 1] ?? "") && /\d/.test(normalized[index + 1] ?? "")) continue;

    let end = index + 1;
    while (end < normalized.length && normalized[end] === punctuation) end += 1;
    while (end < normalized.length && /["'”’\)\]}]/.test(normalized[end])) end += 1;
    if (end < normalized.length && !/\s/.test(normalized[end])) continue;

    if (punctuation === ".") {
      const prefix = normalized.slice(start, index + 1);
      const token = prefix.match(/(?:^|\s)([^\s]+)$/)?.[1]?.toLocaleLowerCase("en-US") ?? "";
      if (CREATOR_SCRIPT_SENTENCE_ABBREVIATIONS.has(token) || /^(?:[a-z]\.){2,}$/i.test(token)) continue;
    }

    const sentence = normalized.slice(start, end).trim();
    if (sentence) sentences.push(sentence);
    start = end;
    while (start < normalized.length && /\s/.test(normalized[start])) start += 1;
    index = start - 1;
  }

  const remainder = normalized.slice(start).trim();
  if (remainder) sentences.push(remainder);
  return sentences;
}

function packCreatorScriptSentences(sentences: readonly string[], requestedCount: number) {
  const count = Math.min(Math.max(1, requestedCount), sentences.length);
  if (count === 1) return [sentences.join(" ")];
  const weights = sentences.map((sentence) => sentence.split(/\s+/).filter(Boolean).length);
  const groups: string[] = [];
  let sentenceIndex = 0;
  let remainingWeight = weights.reduce((sum, weight) => sum + weight, 0);

  for (let groupIndex = 0; groupIndex < count; groupIndex += 1) {
    const groupsRemaining = count - groupIndex;
    if (groupsRemaining === 1) {
      groups.push(sentences.slice(sentenceIndex).join(" "));
      break;
    }
    const maximumEnd = sentences.length - (groupsRemaining - 1);
    const targetWeight = remainingWeight / groupsRemaining;
    let end = sentenceIndex;
    let groupWeight = 0;
    while (end < maximumEnd) {
      const nextWeight = weights[end];
      if (end > sentenceIndex && Math.abs(groupWeight - targetWeight) <= Math.abs(groupWeight + nextWeight - targetWeight)) break;
      groupWeight += nextWeight;
      end += 1;
    }
    groups.push(sentences.slice(sentenceIndex, end).join(" "));
    sentenceIndex = end;
    remainingWeight -= groupWeight;
  }
  return groups;
}

export function createCreatorScriptSceneSegments(script: CreatorScript, sceneCount: number) {
  const sectionSentences = script.sections.map((section) => splitCreatorScriptSentences(section.text));
  const sectionWordCounts = sectionSentences.map((sentences) => sentences.reduce(
    (sum, sentence) => sum + sentence.split(/\s+/).filter(Boolean).length,
    0,
  ));
  const totalWords = sectionWordCounts.reduce((sum, wordCount) => sum + wordCount, 0);
  const safeCount = Math.max(
    script.sections.length,
    Math.min(36, Math.max(1, totalWords), Math.round(sceneCount)),
  );
  const allocations = script.sections.map(() => 1);
  for (let remaining = safeCount - script.sections.length; remaining > 0; remaining -= 1) {
    let selected = -1;
    let selectedPressure = -1;
    sectionSentences.forEach((sentences, index) => {
      if (allocations[index] >= sentences.length) return;
      const pressure = sectionWordCounts[index] / allocations[index];
      if (pressure > selectedPressure) {
        selected = index;
        selectedPressure = pressure;
      }
    });
    if (selected < 0) break;
    allocations[selected] += 1;
  }
  const segments = script.sections.flatMap((section, sectionIndex) => {
    const sentences = sectionSentences[sectionIndex];
    return packCreatorScriptSentences(sentences, allocations[sectionIndex]).map((narration) => ({
      sectionId: section.id,
      narration,
      claimIds: section.claimIds,
    }));
  });
  return segments.map((segment, index) => ({
    id: index + 1,
    narration: segment.narration,
    scriptRevision: script.revision,
    scriptSectionId: segment.sectionId,
    scriptSegmentIndex: index,
    editorialClaimIds: segment.claimIds,
  }));
}

export function assembleCreatorScriptScenes<TScene extends Record<string, unknown>>(input: {
  segments: ReturnType<typeof createCreatorScriptSceneSegments>;
  sceneShells: readonly TScene[];
  createSceneShell: (index: number) => TScene;
}) {
  return input.segments.map((segment, index) => ({
    ...(input.sceneShells[index] ?? input.createSceneShell(index)),
    narration: segment.narration,
    dialogue: "",
    scriptRevision: segment.scriptRevision,
    scriptSectionId: segment.scriptSectionId,
    scriptSegmentIndex: segment.scriptSegmentIndex,
    editorialClaimIds: segment.editorialClaimIds,
  }));
}

export function shouldSurfaceCreatorScriptOperationFailure(input: {
  origin: { projectId: string; generation: number };
  active: { projectId: string; generation: number };
  sourceRevision: number;
  installedRevision: number | null;
  currentRevision: number | null;
}) {
  if (input.origin.projectId !== input.active.projectId || input.origin.generation !== input.active.generation) return false;
  const expectedRevision = input.installedRevision ?? input.sourceRevision;
  return input.currentRevision === expectedRevision;
}
