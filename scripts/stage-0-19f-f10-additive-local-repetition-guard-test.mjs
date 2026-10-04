import assert from "node:assert/strict";
import fs from "node:fs";

import {
  creatorScriptAdditiveExpansionIntroducesLocalRepetition,
  selectCreatorScriptExpansionCandidates,
} from "../lib/creator/creatorScript.ts";

const fixtures = [
  {
    sectionId: "section-1",
    gainWords: 78,
    sectionText:
      "Status is a powerful force in human life, shaping how we see ourselves and how others see us. Today, work is one of the main ways people gain status. The human desire for status may remain, but the ways we express and measure it could transform in unexpected ways.",
    additionalText:
      "Status is not just about external recognition; it deeply influences our self-esteem and social interactions. When work serves as the main status marker, it simplifies how we understand social hierarchies. But if that marker fades, the social landscape may become more complex and fluid, with multiple competing sources of status emerging simultaneously. This could lead to richer, more diverse ways people express their value and connect with others, but also to new forms of social tension and competition.",
    repetitive: false,
  },
  {
    sectionId: "section-2",
    gainWords: 62,
    sectionText:
      "The causal process here is that technological abundance changes what is scarce, and scarcity drives the value of money. So, money doesn’t vanish; it evolves alongside what society values and desires. Understanding this helps us see that a post-work world might not be one without money, but one where money’s meaning and function are transformed by new forms of scarcity and social signaling.",
    additionalText:
      "This causal shift means that money’s importance is tied less to survival and more to navigating new social and cultural landscapes. It becomes a tool for accessing what remains scarce and valued, rather than a mere means to meet basic needs. Understanding this helps us see that money’s role is adaptable, shaped by what society collectively deems important at any given time.",
    repetitive: true,
  },
  {
    sectionId: "section-3",
    gainWords: 55,
    sectionText:
      "Research shows that many unemployed individuals resist the idea that work fully defines their identity or self-worth. Some see a job as just a job, not necessarily a calling or a source of deep meaning. The shift away from work-centered identity is both a loss and a possibility, inviting us to reconsider what gives our lives coherence and value beyond traditional employment.",
    additionalText:
      "This evidence shows that identity tied to work is not universal or fixed. It varies across individuals and cultures, and many people already find ways to define themselves beyond their jobs. This suggests that as paid work becomes less central, identity may become more pluralistic and self-directed, though the transition could be difficult and uneven.",
    repetitive: false,
  },
  {
    sectionId: "section-4",
    gainWords: 63,
    sectionText:
      "This tension highlights that meaning in a post-work world is neither guaranteed nor lost. It depends on how individuals and societies adapt to new freedoms and challenges, and how they redefine what it means to live a purposeful life.",
    additionalText:
      "This tension highlights that meaning in a post-work world is not predetermined. It depends on how individuals and societies choose to engage with new freedoms and challenges. Meaning may be found in voluntary pursuits and social connections rather than economic necessity, but this requires active effort and cultural adaptation. The future of meaning is open-ended, inviting us to rethink what makes life worthwhile.",
    repetitive: true,
  },
];

for (const fixture of fixtures) {
  assert.equal(
    creatorScriptAdditiveExpansionIntroducesLocalRepetition({
      sectionText: fixture.sectionText,
      additionalText: fixture.additionalText,
    }),
    fixture.repetitive,
    fixture.sectionId,
  );
}

const validCandidates = fixtures
  .filter((fixture) => !creatorScriptAdditiveExpansionIntroducesLocalRepetition({
    sectionText: fixture.sectionText,
    additionalText: fixture.additionalText,
  }))
  .map((fixture) => ({
    sectionId: fixture.sectionId,
    gainWords: fixture.gainWords,
    value: fixture.sectionId,
  }));

const selected = selectCreatorScriptExpansionCandidates({
  deficitWords: 125,
  candidates: validCandidates,
  canonicalSectionOrder: fixtures.map((fixture) => fixture.sectionId),
});

assert.deepEqual(
  selected.map((candidate) => candidate.sectionId),
  ["section-1", "section-3"],
  "the live-run repetitive money/meaning additions must be excluded while the novel status/identity additions satisfy the deficit",
);

const coordinator = fs.readFileSync(
  new URL("../lib/creator/creatorScriptBuildScriptRepairCoordinator.ts", import.meta.url),
  "utf8",
);
assert.match(
  coordinator,
  /creatorScriptAdditiveExpansionIntroducesLocalRepetition/u,
);
assert.match(
  coordinator,
  /return \[\];/u,
);
assert.match(
  coordinator,
  /CREATOR_SCRIPT_BUILD_REPAIR_LOCAL_REPETITION/u,
);

const provider = fs.readFileSync(
  new URL("../lib/creator/creatorScriptBuildProviders.server.ts", import.meta.url),
  "utf8",
);
assert.match(provider, /genuinely new supporting material/u);
assert.match(provider, /Do not restate, paraphrase, summarize/u);
assert.match(provider, /reuse the same sentence opening/u);

console.log("stage-0-19f-f10-additive-local-repetition-guard-test: PASS");
