import {createCreatorStrategyFingerprint} from "./creatorScript.ts";
import {normalizeCreatorTopicAuthority} from "./creatorWorkflowAuthority.ts";

/** One fingerprint input projection for the editor and read-only owner check.
 * No fingerprint is installed or repaired here. Preserve the v1 algorithm. */
export function createCreatorStrategyBindingFingerprint(input: Record<string,unknown>) {
  const mentor=input.mentorResult as Record<string,unknown>|null;
  return createCreatorStrategyFingerprint({...input,topic:normalizeCreatorTopicAuthority(input.topic),mentorResult:mentor?{
    audienceInsight:mentor.audienceInsight,hookPatterns:mentor.hookPatterns,videoIdeas:mentor.videoIdeas,recommendedIdea:mentor.recommendedIdea,productionPlan:mentor.productionPlan,
  }:null});
}
