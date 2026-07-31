import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let ts = null;
try {
  ts = require("typescript");
} catch {
  // Marker verification still runs in minimal patch environments.
}

const root = process.cwd();
const files = {
  page: "app/create/page.tsx",
  storeAudio: "app/api/store-audio/route.ts",
  storeDialogue: "app/api/store-dialogue-audio/route.ts",
  profiles: "lib/creator/voiceProfiles.ts",
  resolver: "lib/providers/voice/voiceProfileResolver.ts",
};

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`VOICE-P1 / 3M missing file: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, "utf8");
}

const sources = Object.fromEntries(
  Object.entries(files).map(([key, relativePath]) => [key, read(relativePath)]),
);

const assertions = [
  [sources.profiles.includes("VELTO_VOICE_P1_3M"), "verification marker"],
  [sources.profiles.includes("velto_balanced"), "balanced voice profile"],
  [sources.profiles.includes("velto_authoritative"), "authoritative voice profile"],
  [sources.page.includes("Narrator voice for this scene"), "scene narrator override"],
  [sources.page.includes("Dialogue voice for this scene"), "scene dialogue override"],
  [sources.page.includes("Voice credit estimate"), "voice credit estimate"],
  [sources.page.includes("Speech-cut protection"), "speech-cut protection guidance"],
  [sources.page.includes("voicePreferences"), "project voice preference persistence"],
  [sources.storeAudio.includes("resolveCreatorVoiceProfileVoiceId"), "narrator profile resolver"],
  [sources.storeDialogue.includes("resolveCreatorVoiceProfileVoiceId"), "dialogue profile resolver"],
];

for (const [passed, label] of assertions) {
  if (!passed) throw new Error(`VOICE-P1 / 3M verification failed: ${label}`);
}

if (ts) {
  for (const relativePath of Object.values(files)) {
    const source = read(relativePath);
    const result = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.Preserve,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
      fileName: relativePath,
      reportDiagnostics: true,
    });
    const errors = (result.diagnostics || []).filter(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    );
    if (errors.length) {
      const message = errors
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
        .join("\n");
      throw new Error(`VOICE-P1 / 3M syntax check failed for ${relativePath}:\n${message}`);
    }
  }
}

console.log("VOICE-P1 / 3M smoke verification passed.");
