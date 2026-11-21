import { CreatorAudioAssetError, descriptorFromRegisteredAudio, verifyCreatorAudioUploadIntent } from "./audioAssets.ts";
import type { MediaAssetRepository } from "@/lib/persistence/media/types";
import type { ProjectRepository } from "@/lib/persistence/projects/types";

const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function authorizeCreatorAudioAssetRequest(input: {
  action: unknown;
  projectId: unknown;
  intentToken?: unknown;
  secret: string;
  now?: number;
}, dependencies: {
  authenticate: () => Promise<{ id: string }>;
  projectRepository: Pick<ProjectRepository, "getForOwner">;
}) {
  const principal = await dependencies.authenticate();
  const projectId = typeof input.projectId === "string" ? input.projectId.trim() : "";
  if (!PROJECT_ID.test(projectId) || (input.action !== "initiate" && input.action !== "finalize")) {
    throw new CreatorAudioAssetError("invalid_intent", "Audio upload request is invalid.");
  }
  if (input.action === "finalize") {
    if (typeof input.intentToken !== "string") throw new CreatorAudioAssetError("invalid_intent", "Audio upload request is invalid.");
    const verified = verifyCreatorAudioUploadIntent(input.intentToken, { ownerUserId: principal.id, secret: input.secret, now: input.now });
    if (verified.projectId !== projectId) throw new CreatorAudioAssetError("invalid_intent", "Audio upload authorization is invalid.");
  }
  const project = await dependencies.projectRepository.getForOwner(projectId, principal.id);
  if (!project || project.flow_type !== "creator_lab") {
    throw new CreatorAudioAssetError("asset_not_found", "Project was not found.");
  }
  return { ownerUserId: principal.id, projectId };
}

export async function resolveOwnedCreatorAudioAsset(input: {
  ownerUserId: string;
  projectId: string;
  assetId: string;
}, repositories: { mediaAssetRepository: MediaAssetRepository; projectRepository: ProjectRepository }) {
  if (!input.ownerUserId.trim() || !input.projectId.trim() || !input.assetId.trim()) {
    throw new CreatorAudioAssetError("asset_not_found", "Audio asset was not found.");
  }
  const project = await repositories.projectRepository.getForOwner(input.projectId, input.ownerUserId);
  if (!project || project.flow_type !== "creator_lab") {
    throw new CreatorAudioAssetError("asset_not_found", "Audio asset was not found.");
  }
  const asset = await repositories.mediaAssetRepository.getForOwner(input.assetId, input.ownerUserId);
  if (!asset) throw new CreatorAudioAssetError("asset_not_found", "Audio asset was not found.");
  return descriptorFromRegisteredAudio(asset, input.ownerUserId, input.projectId);
}
