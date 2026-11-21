import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inferCreatorScriptFocusedSectionSelection as infer } from "../lib/creator/creatorScriptNaturalRefinementIntent.ts";

const sections = [
  { kind: "opening", text: "A useful opening introduces the question." },
  { kind: "body", text: "Second section explains the observed effects." },
  { kind: "body", text: "Third section sets up the counterargument." },
  { kind: "conclusion", text: "The final conclusion leaves a meaningful question." },
];
const doc = sections.map((section) => section.text).join("\n\n");
let checks = 0;
function target(input, expectedIndex) {
  const result = infer(input, sections, doc);
  assert.ok(result, input);
  assert.equal(result.sectionIndex, expectedIndex, input);
  assert.equal(result.text, sections[expectedIndex].text);
  assert.equal(doc.slice(result.start, result.end), result.text);
  checks++;
}
function refuse(input) {
  assert.equal(infer(input, sections, doc), null, input);
  checks++;
}
target("Please rewrite the conclusion to be less repetitive", 3);
target("Make the ending more thought-provoking", 3);
target("Improve the closing question", 3);
target("Sonuç bölümünü güçlendir", 3);
target("Kapanışı yeniden yaz", 3);
target("Strengthen the second section", 1);
target("Revise section 2", 1);
target("İkinci bölümü iyileştir", 1);
target("Rewrite the third section", 2);
target("Üçüncü bölüm daha anlaşılır olsun", 2);
refuse("Improve the script's narrative flow");
refuse("Rewrite the whole script, especially the conclusion");
refuse("Revise the second section and the conclusion");
refuse("Change the second and third sections");
refuse("Do not change the conclusion; improve the rest");
refuse("Keep the ending but revise everything else");
refuse("Rewrite the second paragraph");
refuse("Bring more sources for the conclusion and body");
assert.equal(infer("Rewrite the ending", sections, "stale document"), null); checks++;
assert.equal(infer("Rewrite the conclusion", [{kind:"opening", text:"Only opening"}], "Only opening"), null); checks++;
const ui = readFileSync(new URL("../components/create/CreatorScriptReview.tsx", import.meta.url), "utf8");
assert.match(ui, /inferCreatorScriptFocusedSectionSelection/); checks++;
assert.match(ui, /inferredSectionSelection/); checks++;
assert.match(ui, /scope: "selection" as const, mode: "focused_edit" as const, instruction: refineInstruction, selectionStart: inferredSectionSelection.start/); checks++;
assert.match(ui, /data-creator-refinement-action="preview"/); checks++;
assert.match(ui, /bg-blue-600/); checks++;
assert.match(ui, /focus-visible:ring/); checks++;
assert.match(ui, /data-creator-refinement-action-feedback="true"/); checks++;
assert.match(ui, /!canPreviewRefinement && !inferredSectionSelection/); checks++;
assert.doesNotMatch(ui, /<select aria-label/); checks++;
console.log(JSON.stringify({status:"ISSUE50_NO_SELECTION_FOCUSED_TARGET_AND_CTA_PASS", checks, externalProviderCalls:0, productionGateChanged:false}));
