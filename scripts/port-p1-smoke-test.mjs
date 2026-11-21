import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(`PORT-P1 verification failed: ${message}`);
};

const legacyVideoRoute = read("app/api/video/route.ts");
const healthRoute = read("app/api/video/health/route.ts");
const facade = read("lib/providers/mediaProviderFacade.ts");
const registry = read("lib/video/providers/providerRegistry.ts");
const page = read("app/create/page.tsx");
const timeline = read("lib/video/timelineSync.ts");

assert(!legacyVideoRoute.includes("@runwayml/sdk"), "legacy video route still imports a provider SDK");
assert(legacyVideoRoute.includes("getMediaProviderFacade"), "legacy video route does not use the facade");
assert(!healthRoute.includes("RUNWAY_API_KEY") && !healthRoute.includes("VEO_API_KEY"), "health route exposes provider-specific configuration");
assert(facade.includes("selectCreatorVideo") && facade.includes("selectPrimaryVideo"), "media provider facade is incomplete");
assert(registry.includes("let providers:"), "video provider registry is not singleton-backed");
assert(timeline.includes("normalizeVideoClipDuration"), "provider-neutral duration policy is missing");
assert(!page.includes("Character voiceId (ElevenLabs)") && !page.includes("Karakter voiceId (ElevenLabs)"), "visible provider brand remains in voice controls");
assert(page.includes("CREATOR_QUALITY_MODE_OPTIONS"), "quality options are not sourced from routing policy");

console.log("PORT-P1 / 3K / 3O smoke verification passed.");
