import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildCreatorVideoProviderPrompt,
  buildRunwaySafeCreatorVideoPrompt,
  RUNWAY_VIDEO_PROMPT_HARD_MAX_CHARACTERS,
  RUNWAY_VIDEO_PROMPT_TARGET_CHARACTERS,
  assertRunwayVideoPromptWithinLimit,
} from "../lib/creator/videoPromptPolicy.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const repeat = (text, count) => Array.from({ length: count }, () => text).join(" ");
const longInput = {
  text: repeat("A detailed documentary scene connects reconstructive memory, personal identity, testimony, social influence and lived consequence.", 12),
  motionHint: repeat("Gentle environmental movement with layered foreground and background activity while the subject remains naturally expressive.", 5),
  cameraDirection: repeat("Maintain a wide stable composition with restrained lateral drift and carefully controlled cinematic perspective.", 5),
  emotion: repeat("Reflective, intimate, uncertain and quietly consequential.", 4),
};
const rawLong = buildCreatorVideoProviderPrompt(longInput);
assert.ok(rawLong.length > RUNWAY_VIDEO_PROMPT_HARD_MAX_CHARACTERS, "real semantic builder must reproduce the former Runway rejection");
const bounded = buildRunwaySafeCreatorVideoPrompt(longInput);
assert.ok(bounded.length <= RUNWAY_VIDEO_PROMPT_TARGET_CHARACTERS);
assert.doesNotThrow(() => assertRunwayVideoPromptWithinLimit(bounded));
assert.throws(() => assertRunwayVideoPromptWithinLimit("x".repeat(1_001)), /RUNWAY_VIDEO_PROMPT_LIMIT_EXCEEDED/);
assert.match(bounded, /Motion: Gentle environmental movement/);
assert.match(bounded, /Camera: Maintain a wide stable composition/);
assert.match(bounded, /Context: A detailed documentary scene/);
assert.match(bounded, /Preserve source framing, subject scale, identity, field of view and composition/);
assert.match(bounded, /No zoom, push-in, crop, close-up/);
assert.match(bounded, /No generated text, captions, subtitles, titles, logos, watermarks or typography/);
assert.match(bounded, /No frozen frames, abrupt morphing or unrelated scene changes/);
assert.equal(buildRunwaySafeCreatorVideoPrompt(longInput), bounded, "budgeting must be byte-deterministic");
assert.ok(!/[\p{L}\p{N}]$/u.test(bounded) || /[.!?]$/.test(bounded), "bounded output must not end in a partial word");

const shortInput = { text: "A guitarist performs on stage.", motionHint: "gentle lateral camera drift", cameraDirection: "static wide framing", emotion: "triumphant" };
assert.equal(buildRunwaySafeCreatorVideoPrompt(shortInput), buildCreatorVideoProviderPrompt(shortInput), "short prompts remain unchanged");

const unsafe = buildRunwaySafeCreatorVideoPrompt({
  text: repeat("A subject remains centered in the supplied image.", 30),
  motionHint: "slow zoom in while bold text fade-in appears " + repeat("with dramatic movement", 20),
  cameraDirection: "dramatic push-in toward subject and tight crop " + repeat("with unstable framing", 20),
  emotion: "urgent",
});
assert.doesNotMatch(unsafe, /slow zoom in|dramatic push-in toward subject|tight crop|bold text fade-in/i);
assert.match(unsafe, /subtle parallax and restrained lateral movement/i);
assert.match(unsafe, /stable cinematic framing with gentle camera drift/i);

const route = read("app/api/creator-video/route.ts");
const runway = read("lib/video/providers/runwayAdapter.ts");
const veo = read("lib/video/providers/veoAdapter.ts");
assert.match(route, /selection\.provider\.key === "runway"[\s\S]*buildRunwaySafeCreatorVideoPrompt\(body\)[\s\S]*buildCreatorVideoProviderPrompt\(body\)/);
assert.match(runway, /assertRunwayVideoPromptWithinLimit\(input\.promptText\)[\s\S]*createRunwayTask/);
assert.doesNotMatch(veo, /runwayPromptBudget|RUNWAY_VIDEO_PROMPT/);
assert.doesNotMatch(read("lib/creator/videoPromptPolicy.ts"), /slice\(0,\s*1_?000\)/);

console.log(`STAGE_0_17C_RUNWAY_PROMPT_BUDGET=PASS raw=${rawLong.length} bounded=${bounded.length}`);
