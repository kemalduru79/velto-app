import assert from "node:assert/strict";
import { createResearchOrchestrationPlan } from "../lib/research/researchOrchestration.ts";

const fact = createResearchOrchestrationPlan({
  subject: "a public statement about the future of work",
  claimType: "FACT",
});
assert.equal(fact.version, "0.10H-1F");
assert.equal(fact.lanes[0].purpose, "baseline");
assert.ok(fact.lanes.some((lane) => lane.purpose === "primary_source"));
assert.ok(fact.lanes.some((lane) => lane.purpose === "counter_evidence"));
assert.ok(fact.lanes.length <= 4);

const researchFinding = createResearchOrchestrationPlan({
  subject: "digital media use and parental stress",
  claimType: "RESEARCH_FINDING",
  maxResultsPerLane: 99,
});
const supporting = researchFinding.lanes.find((lane) => lane.purpose === "supporting_evidence");
const counter = researchFinding.lanes.find((lane) => lane.purpose === "counter_evidence");
assert.equal(supporting?.input.category, "academic");
assert.equal(counter?.input.category, "academic");
assert.equal(supporting?.input.maxResults, 6);

const forecast = createResearchOrchestrationPlan({
  subject: "automation and future employment",
  claimType: "FORECAST",
});
assert.ok(forecast.lanes.some((lane) => lane.purpose === "recent_context"));
assert.equal(
  forecast.lanes.find((lane) => lane.purpose === "recent_context")?.required,
  true,
);

const metaphysical = createResearchOrchestrationPlan({
  subject: "a metaphysical claim about pre-birth purpose",
  claimType: "METAPHYSICAL_CLAIM",
});
assert.ok(metaphysical.lanes.some((lane) => lane.purpose === "counter_evidence"));
assert.equal(
  metaphysical.lanes.find((lane) => lane.purpose === "counter_evidence")?.input.category,
  "web",
);

const thoughtExperiment = createResearchOrchestrationPlan({
  subject: "a society where paid work is unnecessary",
  claimType: "THOUGHT_EXPERIMENT",
});
assert.equal(
  thoughtExperiment.lanes.some((lane) => lane.purpose === "counter_evidence"),
  false,
);

const serialized = JSON.stringify([
  fact,
  researchFinding,
  forecast,
  metaphysical,
  thoughtExperiment,
]).toLowerCase();
for (const forbidden of ["truth score", "debunk", "is false", "is true"]) {
  assert.equal(serialized.includes(forbidden), false, `forbidden editorial verdict: ${forbidden}`);
}

assert.throws(
  () => createResearchOrchestrationPlan({ subject: "   " }),
  /RESEARCH_SUBJECT_REQUIRED/,
);

console.log("Stage 0.10H-1F counter-evidence orchestration tests passed.");
