import { EpidemicMusicAdapter } from "./epidemic";
import type { MusicProvider } from "./types";

let provider: MusicProvider | null = null;
export function getMusicProvider(): MusicProvider {
  provider ||= new EpidemicMusicAdapter();
  return provider;
}
export type { CreatorPremiumMusicTrack, MusicPreviewResult, MusicProvider, MusicSearchInput, MusicSearchResult } from "./types";
