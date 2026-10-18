import OpenAI from "openai";
import { recordOpenAITextEconomics } from "../economics/index.ts";
import type { ResearchSource } from "../research/sourceContract.ts";
import { createCreatorScriptBuildProviderExecutors } from "./creatorScriptBuildProviders.server.ts";
import type { CreatorScriptEditorialRewriteDependencies, CreatorScriptRewriteGoalResult, CreatorScriptRewriteProviderCandidate } from "./creatorScriptEditorialRewrite.ts";
import { creatorScriptRefinementModelOptions, resolveCreatorScriptRefinementModel } from "./creatorScriptRefinementRuntime.ts";

const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

export function createCreatorScriptEditorialRewriteProviders(input: { ownerId: string; projectId: string }): CreatorScriptEditorialRewriteDependencies {
  const buildProviders = createCreatorScriptBuildProviderExecutors(input);
  const model = resolveCreatorScriptRefinementModel({ OPENAI_REFINEMENT_MODEL: process.env.OPENAI_REFINEMENT_MODEL, OPENAI_SCRIPT_MODEL: process.env.OPENAI_SCRIPT_MODEL, OPENAI_MODEL: process.env.OPENAI_MODEL });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const call = async (operationType: string, system: string, user: unknown) => {
    const response = await openai.responses.create({ model, input: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(user) }], text: { format: { type: "json_object" } }, max_output_tokens: 16_000, ...creatorScriptRefinementModelOptions(model, 0.2) });
    await recordOpenAITextEconomics({ route: "/api/creator-script/refine", operationType, model, response, userId: input.ownerId, projectId: input.projectId });
    return JSON.parse(response.output_text || "{}");
  };
  return {
    research: async ({ subject, language }) => {
      const result = record(await buildProviders.executeResearch({ version: "0.19E2A-research-request-v1", subject, language, includeRecentContext: false, maxResultsPerLane: 5 }));
      if (!result || !Array.isArray(result.sources)) throw new Error("CREATOR_SCRIPT_REFINEMENT_MISSING_SOURCES");
      return { sources: result.sources as ResearchSource[] };
    },
    rewrite: async ({ script, instruction, language, goals, sources }) => {
      const result = await call("creator_script_editorial_rewrite", [
        "Produce a complete revised CreatorLab script as strict JSON.",
        "Use only supplied canonical sources. Any new evidence excerpt must be copied exactly from a supplied source summary.",
        "Every new claim must reference at least one new evidence ID. Bind each factual section to its claim IDs.",
        "Preserve opening/body/conclusion structure, but section IDs may be retained, reordered, split, or merged when a structural goal requires it.",
        "Do not self-report goal success here. Return sections, addedClaims, and addedEvidence only.",
        language === "en" ? "Write audience-facing English." : "Write audience-facing Turkish.",
      ].join(" "), { instruction, goals, script, sources: sources.map((source) => ({ ...source, sourceMetadata: undefined })) });
      const raw = record(result);
      if (!raw || !Array.isArray(raw.sections) || !Array.isArray(raw.addedClaims) || !Array.isArray(raw.addedEvidence)) throw new Error("CREATOR_SCRIPT_REFINEMENT_PROVIDER_OUTPUT_INVALID");
      return { sections: raw.sections, addedClaims: raw.addedClaims, addedEvidence: raw.addedEvidence, goalResults: [] } as CreatorScriptRewriteProviderCandidate;
    },
    assess: async ({ before, after, goals }) => {
      const result = await call("creator_script_editorial_rewrite_assessment", "Independently assess each requested editorial goal against before and after scripts. Return strict JSON {goalResults:[{goalId,status,sectionIds,summary}]}. Use status satisfied only for a material, observable change; otherwise blocked. Never infer evidence beyond canonical claim bindings.", { goals, before, after });
      const raw = record(result);
      if (!raw || !Array.isArray(raw.goalResults)) throw new Error("CREATOR_SCRIPT_REFINEMENT_PROVIDER_OUTPUT_INVALID");
      return raw.goalResults as CreatorScriptRewriteGoalResult[];
    },
  };
}
