import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) {
    console.error(`VOICE-P1B verification failed: ${message}`);
    process.exit(1);
  }
};

const page = read("app/create/page.tsx");
const route = read("app/api/voice-library/route.ts");
const adapter = read("lib/providers/voice/elevenLabsVoiceAdapter.ts");
const types = read("lib/providers/voice/types.ts");
const dialogue = read("app/api/store-dialogue-audio/route.ts");
const library = read("lib/creator/voiceLibrary.ts");

assert(page.includes("VELTO_VOICE_P1B"), "page marker is missing");
assert(page.includes("Browse narrator voices"), "project narrator browser is missing");
assert(page.includes("Choose character voice"), "character voice browser is missing");
assert(page.includes("Change narrator voice"), "scene narrator override is missing");
assert(page.includes("Explore library"), "shared voice library tab is missing");
assert(page.includes("Preview playback does not use Velto credits"), "preview credit disclosure is missing");
assert(page.includes("voiceSelection: narratorSettings.voiceSelection"), "project voice selection persistence is missing");
assert(page.includes("narratorVoiceSelection: normalizeVoiceLibrarySelection"), "scene voice hydration is missing");
assert(page.includes("getEffectiveDialogueVoiceId(scene)"), "dialogue voice routing is missing");
assert(route.includes("authenticateRequest"), "voice library API is not authenticated");
assert(route.includes("getVoiceProvider"), "voice library API bypasses provider abstraction");
assert(adapter.includes("/v2/voices"), "available voice listing is missing");
assert(adapter.includes("/v1/shared-voices"), "shared voice listing is missing");
assert(adapter.includes("/v1/voices/add/"), "shared voice add flow is missing");
assert(types.includes("listVoices"), "voice provider list contract is missing");
assert(types.includes("addSharedVoice"), "voice provider add contract is missing");
assert(dialogue.includes("explicitBodyVoiceId"), "explicit scene/project dialogue voice is not respected");
assert(library.includes("CREATOR_VOICE_FAVORITES_STORAGE_KEY"), "favorites persistence is missing");
assert(!page.includes("NEXT_PUBLIC_ELEVENLABS_API_KEY"), "provider API key leaked to the client");

console.log("VOICE-P1B smoke verification passed.");
