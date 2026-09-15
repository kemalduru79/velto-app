import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const review = await readFile(new URL("../components/create/CreatorScriptReview.tsx", import.meta.url), "utf8");

for (const internalCopy of [
  "provider task",
  "provider request",
  "provider dispatch",
  "Provider details remain internal",
  "technical provider choices internal",
  "provider routing in the background",
  "Provider usage is recorded",
  "Cancel before dispatch",
  "servis talebi",
  "servis görevi",
  "servise gönderilmeden",
  "sağlayıcı yönlendirmesini",
  "teknik sağlayıcı seçimlerini",
]) {
  const sourceLines = page.split("\n");
  const visibleLiteralMatch = sourceLines.some((line) => {
    const trimmed = line.trim();
    return !trimmed.startsWith("//") && trimmed.toLowerCase().includes(internalCopy.toLowerCase());
  });
  assert.equal(visibleLiteralMatch, false, `creator-facing copy must not include: ${internalCopy}`);
}

assert.match(page, /Usage is recorded when generation starts\. Completed generation cannot be undone\./);
assert.match(page, /A request that already started may still complete\./);
assert.match(page, /You can cancel until the countdown reaches zero\./);
assert.match(page, /Natural delivery prioritizes nuance; Fast preview prioritizes speed\./);
assert.match(page, /Velto Studio handles the production details\./);

const scriptIndex = review.indexOf("Complete script");
const refinementIndex = review.indexOf("Refine with AI");
const historyIndex = review.indexOf('language === "en" ? "History"');
const sectionToolsIndex = review.indexOf("Section tools");
const approvalIndex = review.indexOf("Approve the current script revision");
assert.ok(scriptIndex >= 0 && scriptIndex < refinementIndex, "the continuous script remains the primary editorial surface");
assert.ok(refinementIndex < historyIndex && historyIndex < sectionToolsIndex, "secondary editorial tools remain ordered after the script");
assert.ok(sectionToolsIndex < approvalIndex, "approval readiness remains the final transition action");
assert.match(review, /<details[^>]*data-creator-script-revision-history="true"/);
assert.match(review, /<details className="group[^>]*open=\{evidenceReviewBlocked \|\| undefined\}/);

console.log("STAGE_0_13J_PRODUCTION_FEEDBACK_CONSOLIDATION=PASS");
