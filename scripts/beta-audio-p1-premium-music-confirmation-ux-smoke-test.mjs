import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/create/page.tsx");
const music = read("lib/creator/backgroundMusic.ts");
const picker = read("components/create/CreatorBackgroundMusic.tsx");
const acquisition = read("lib/creator/musicEntitlement.ts");

const checks = [];
const check = (condition, label) => {
  assert.ok(condition, label);
  checks.push(label);
};

check(/creatorMusicConfirmationRequired[\s\S]*mode === "selected"[\s\S]*confirmedTrackId !== creatorBackgroundMusic\.selectedTrackId/.test(page), "selected premium music has a track-bound confirmation blocker");
check(/data-confirm-selected-music="true"[\s\S]*Confirm This Music/.test(picker), "selected-track card exposes exact confirmation action");
check(/data-change-premium-music="true"[\s\S]*selectCreatorProductionSubstep\("setup"\)[\s\S]*creatorlab-background-music/.test(page), "Change Music reuses the existing picker");
check(/confirmedTrackId/.test(music) && /backgroundMusic:\s*lifecycleOverrides\.backgroundMusic \?\? creatorBackgroundMusic/.test(page), "confirmation persists in the existing project music config");
check(/mode === "selected" &&[\s\S]*confirmedTrackId/.test(music) && !/confirmedTrackId/.test(JSON.stringify({ mode: "none" })), "No Music has no confirmation requirement");
check(!/onConfirmTrack[\s\S]{0,1200}(reserve|credit|cost-guard|creator-music\/acquire)/i.test(page), "confirmation adds no credit or acquisition call");
check(/if \(!dependencies\.acquisitionEnabled\) throw new CreatorMusicAcquisitionError\("disabled"\)/.test(acquisition), "commercial acquisition remains fail-closed");
check(/!creatorProductionComplete[\s\S]*creatorNextProductionAction\.buttonLabel/.test(page), "blocked Build Final Video remains visible");
check(/confirm premium music to continue/i.test(page), "final blocker reason is visible");
check(/bg-blue-700 text-white shadow-md/.test(page), "ready Build Final Video is primary");
check(/data-creator-editor-entry="true"[\s\S]*border-slate-300 bg-white/.test(page), "Edit Video is secondary");
check(/creatorMusicConfirmationRequired[\s\S]*Production assets are ready[\s\S]*All production assets are ready/.test(page), "ready copy is qualified while music is blocked");
check(/setCreatorBackgroundMusic\(confirmedMusic\)[\s\S]*setError\(""\)/.test(page), "confirmation clears the blocker immediately");
check(!/Storyverse[\s\S]{0,500}data-confirm-selected-music/.test(page) && /isCreatorLabFlow/.test(page), "Storyverse remains isolated");
check(/id="creatorlab-background-music"/.test(picker), "existing music UI provides the Change Music target");
check(/data-selected-music-confirmation-card="true"/.test(picker), "selected music has a compact confirmation card");
check(/selectedTrack\.title[\s\S]*selectedTrack\.artist[\s\S]*selectedTrack\.durationSec/.test(picker), "card identifies title artist and duration");
check(/selectedTrack\.artworkUrl/.test(picker), "card reuses safe artwork when available");
check(/previewTrack\(selectedTrack\)[\s\S]*Play Preview/.test(picker), "card reuses the existing preview player");
check(/creatorBackgroundMusic\.selectedTrackId !== trackId[\s\S]*confirmedTrackId: trackId/.test(page), "confirmation is bound to the current exact track");
check(/const confirmedTrackId[\s\S]*source\.confirmedTrackId === selectedTrackId/.test(music), "a changed selection cannot inherit confirmation");
check(/disabled=\{confirmingTrackId === selectedTrack\.id\}/.test(picker), "confirmation cannot be double-triggered");
check(/continueCreatorProduction[\s\S]*handleExportMovie\(false\)/.test(page), "ready CTA reaches the existing final build handler");
check(/setIsExportingMovie\(true\)/.test(page), "existing final build loading state remains wired");

console.log(`Premium music confirmation UX smoke test passed (${checks.length} checks).`);
