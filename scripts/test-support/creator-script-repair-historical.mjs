import assert from "node:assert/strict";
import fs from "node:fs";
import { createResearchClaimEvidenceGraph } from "../../lib/research/claimEvidenceGraph.ts";
import { resolveClaimAuthority } from "../../lib/research/claimAuthorityResolver.ts";
import { runCreatorScriptBuildScriptGenerationCoordinator } from "../../lib/creator/creatorScriptBuildScriptGenerationCoordinator.ts";
import {
  ownerId, buildId, revision, generationNow, createSnapshot, buildRecord,
  authorityFixture, MemoryRepository, generationProposal, textWithWords, clone,
} from "./creator-script-repair-replay.mjs";

export const historical = Object.freeze(JSON.parse(fs.readFileSync(
  new URL("../fixtures/stage-0-19-repair-e6n-geometry.json", import.meta.url), "utf8",
)));

export async function prepareHistorical(options = {}) {
  const snapshot = createSnapshot({ requestedDurationSeconds: historical.durationSeconds });
  const authority = authorityFixture();
  const safeClaim = authority.graph.claims.find((claim) => claim.claimId === "claim-safe");
  const safeEvidence = authority.graph.evidence.find((evidence) => evidence.evidenceId === "evidence-safe");
  const claims = [1, 2, 3, 4].map((n) => ({ ...safeClaim, claimId: `claim-safe-${n}`,
    text: `Grounded memory finding ${n}.` }));
  const evidence = [1, 2, 3, 4].map((n) => ({ ...safeEvidence, evidenceId: `evidence-safe-${n}`,
    excerpt: `Grounded memory evidence ${n}.` }));
  authority.graph = createResearchClaimEvidenceGraph({ sources: authority.graph.sources,
    claims, evidence, links: claims.map((claim, i) => ({ claimId: claim.claimId,
      evidenceId: evidence[i].evidenceId, stance: "supports" })) });
  authority.finalAuthority = resolveClaimAuthority({ graph: authority.graph, sourceAssessments: authority.sourceAssessments });
  authority.initialAuthority = authority.finalAuthority;
  authority.permittedClaimIds = claims.map((claim) => claim.claimId);
  authority.excludedPrimaryClaimIds = [];
  const record = buildRecord(snapshot);
  record.checkpoints.authority.outputReference.result = authority;
  const repository = new MemoryRepository(record);
  await runCreatorScriptBuildScriptGenerationCoordinator({ ownerId, buildId, dependencies: {
    repository, getCurrentProjectRevision: async () => revision, now: () => generationNow,
    executeScriptGeneration: async (input) => {
      assert.deepEqual(input.sectionPlan.map((s) => [s.id, s.minimumWords, s.targetWords, s.maximumWords]),
        historical.sections.map((s) => [s.id, s.min, s.target, s.max]));
      const proposal = generationProposal(input, "accepted");
      proposal.sections.forEach((section, index) => {
        section.heading = ["Unsettled Beginnings", "Conceptual Foundations", "Causal Reconstruction", "Empirical Observations", "Interpretive Boundaries", "Lasting Consequences"][index];
        section.text = textWithWords(`historical${index}word`, index === 0 && options.openingWords ? options.openingWords : (options.sectionWords?.[index] ?? historical.sections[index].actual));
        section.claimIds = index >= 1 && index <= 4 ? [claims[index - 1].claimId] : [];
      });
      return proposal;
    },
  } });
  repository.transitions.length = 0;
  repository.requestedOperations.length = 0;
  repository.checkpointWrites.length = 0;
  return { repository, snapshot };
}

// Simulates an actual durable reload, rather than sharing mutable objects.
export function reloadRepository(repository) {
  return new MemoryRepository(JSON.parse(JSON.stringify(repository.build)),
    JSON.parse(JSON.stringify([...repository.operations.values()])));
}
export function repairOperations(repository) {
  return [...repository.operations.values()].filter((operation) => operation.stage === "repair").map(clone);
}
