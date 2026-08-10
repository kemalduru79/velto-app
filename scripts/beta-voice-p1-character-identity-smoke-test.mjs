import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ensureCreatorCharacterIds,
  normalizeCreatorDialogueSpeakerCharacterId,
  resolveCreatorDialogueSpeaker,
} from "../lib/creator/characterIdentity.ts";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const identity = read("lib/creator/characterIdentity.ts");
const page = read("app/create/page.tsx");
const scriptPlan = read("app/api/creator-script-plan/route.ts");

const migrated = ensureCreatorCharacterIds([
  { name: "Mert" },
  { name: "Sarah" },
  { name: "Alex" },
]);
assert.equal(new Set(migrated.map((character) => character.id)).size, 3);
assert.ok(migrated.every((character) => character.id.startsWith("creator-char-")));
const stable = ensureCreatorCharacterIds(migrated);
assert.deepEqual(stable.map((character) => character.id), migrated.map((character) => character.id));
const speakerId = migrated[0].id;
const renamed = migrated.map((character) =>
  character.id === speakerId ? { ...character, name: "Michael" } : character,
);
assert.equal(resolveCreatorDialogueSpeaker({ speakerCharacterId: speakerId, characters: renamed })?.name, "Michael");
assert.equal(resolveCreatorDialogueSpeaker({ speakerCharacterId: speakerId, characters: [...renamed].reverse() })?.id, speakerId);
assert.equal(resolveCreatorDialogueSpeaker({ speakerCharacterId: "creator-char-missing", characters: renamed }), undefined);
assert.equal(resolveCreatorDialogueSpeaker({ speakerCharacterId: speakerId, characters: renamed.slice(1) }), undefined);
assert.equal(normalizeCreatorDialogueSpeakerCharacterId("", renamed), undefined);

assert.match(identity, /creator-char-/);
assert.match(identity, /crypto\.randomUUID\(\)/);
assert.match(identity, /ensureCreatorCharacterIds/);
assert.match(identity, /usedIds\.has/);
assert.match(identity, /resolveCreatorDialogueSpeaker/);
assert.match(identity, /normalizeCreatorDialogueSpeakerCharacterId/);
assert.doesNotMatch(identity, /character\.name/);
assert.doesNotMatch(identity, /characters\[0\]/);

assert.match(page, /id: createCreatorCharacterId\(\)/);
assert.match(page, /dialogueSpeakerCharacterId\?: string/);
assert.match(page, /speakerCharacterId: scene\?\.dialogueSpeakerCharacterId/);
assert.match(page, /Dialogue speaker/);
assert.match(page, /Default character voice/);
assert.match(page, /value=\{character\.id\}/);
assert.match(page, /dialogueSpeakerCharacterId: nextSpeakerId/);
assert.match(page, /dialogueSpeakerCharacterId: undefined/);
assert.match(page, /Selection is free and does not generate audio/);
assert.doesNotMatch(
  page.slice(page.indexOf("const getEffectiveDialogueVoiceProfileId"), page.indexOf("const getVoiceLibraryTargetSelection")),
  /toLocaleLowerCase|includes\(|characters\[0\]/,
);

assert.match(scriptPlan, /castAllowlist/);
assert.match(scriptPlan, /exact castAllowlist id/);
assert.match(scriptPlan, /normalizeCreatorDialogueSpeakerCharacterId/);
assert.match(scriptPlan, /characters,\n\s+scenes: enrichedScenes/);
assert.doesNotMatch(scriptPlan, /find\([^)]*name|characters\[0\]/);

assert.match(page, /getEffectiveNarratorVoiceSelection/);
assert.match(page, /narratorSettings\.voiceSelection/);
assert.match(page, /creator_dialogue_voice/);
assert.match(page, /creatorCostGuardHeaders/);

console.log("CreatorLab stable character identity smoke passed (34/34).");
