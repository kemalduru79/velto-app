export type CreatorPremiumMusicTrack = {
  id: string;
  title: string;
  artist?: string;
  durationSec?: number;
  bpm?: number;
  moods: string[];
  genres: string[];
  energy?: "low" | "medium" | "high";
  hasVocals?: boolean;
  artworkUrl?: string;
  previewAvailable: boolean;
};

export type MusicSearchInput = {
  term: string;
  limit?: number;
  offset?: number;
  mood?: string;
  genre?: string;
  vocalType?: "instrumental" | "vocals";
  partnerUserId: string;
};

export type MusicSearchResult = {
  tracks: CreatorPremiumMusicTrack[];
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type MusicPreviewResult = { streamUrl: string; expiresAt?: string };

export interface MusicProvider {
  isAvailable(): boolean;
  searchTracks(input: MusicSearchInput): Promise<MusicSearchResult>;
  getTrackPreview(trackId: string, partnerUserId: string): Promise<MusicPreviewResult>;
}
