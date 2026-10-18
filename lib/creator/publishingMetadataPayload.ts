/**
 * The publishing-copy API only reads these editorial fields. Creator production
 * packages also contain media, timeline and scene authority data; sending those
 * to this endpoint needlessly exceeds its 128 KiB request boundary.
 *
 * Keep the first 12 scenes and their existing text fields to preserve the
 * server-side metadata prompt's current scene-selection semantics.
 */
type PublishingSceneSource = {
  id?: number;
  text?: string;
  narration?: string;
  dialogue?: string;
};

export type PublishingPackageSource = {
  title?: string;
  hook?: string;
  storyPremise?: string;
  youtubeTitle?: string;
  caption?: string;
  thumbnailIdea?: string;
  durationSec?: number;
  scenes?: PublishingSceneSource[];
};

const bounded = (value: unknown, maxLength: number): string =>
  typeof value === "string" ? value.slice(0, maxLength) : "";

export function toCreatorPublishingMetadataPackage(source: PublishingPackageSource) {
  return {
    title: bounded(source.title, 250),
    hook: bounded(source.hook, 1200),
    storyPremise: bounded(source.storyPremise, 2400),
    youtubeTitle: bounded(source.youtubeTitle, 250),
    caption: bounded(source.caption, 2400),
    thumbnailIdea: bounded(source.thumbnailIdea, 500),
    durationSec: source.durationSec,
    scenes: (source.scenes || []).slice(0, 12).map((scene) => ({
      id: scene.id,
      text: bounded(scene.text, 1200),
      narration: bounded(scene.narration, 1800),
      dialogue: bounded(scene.dialogue, 900),
    })),
  };
}
