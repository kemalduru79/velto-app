import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  ProjectRepository,
  PublishVeltoProjectResult,
  SaveVeltoProjectInput,
  SaveVeltoProjectResult,
  VeltoProjectApiRecord,
} from "./types";

const PROJECT_LIST_FIELDS =
  "id, title, child_id, created_at, updated_at, flow_type, scenes, exported_movie_url";
const PUBLIC_PROJECT_FIELDS =
  "id, title, input_prompt, story_premise, language, visual_bible, characters, scenes, share_id, is_public, published_at, created_at, updated_at, exported_movie_url, exported_movie_result, export_signature";

function asProjectRecord(value: unknown): VeltoProjectApiRecord {
  return value as VeltoProjectApiRecord;
}

function createShareId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

function projectPayload(input: SaveVeltoProjectInput) {
  return {
    owner_user_id: input.ownerUserId,
    child_id: input.childId,
    title: input.title,
    input_prompt: input.inputPrompt,
    story_premise: input.storyPremise,
    language: input.language,
    visual_bible: input.visualBible,
    characters: input.characters,
    scenes: input.scenes,
    exported_movie_url: input.exportedMovieUrl,
    exported_movie_result: input.exportedMovieResult,
    export_signature: input.exportSignature,
    flow_type: input.flowType,
    creator_mentor_result: input.creatorMentorResult,
    creator_production_package: input.creatorProductionPackage,
    youtube_metadata: input.youtubeMetadataResult,
    youtube_thumbnail: input.youtubeThumbnailResult,
    scene_optimization: input.sceneOptimizationResult,
    scene_optimization_summary: input.sceneOptimizationSummary,
    refined_creator_scenes: input.refinedCreatorScenes,
  };
}

// VELTO_PORT_P2 — all velto_projects table knowledge is isolated here.
export class SupabaseProjectRepository implements ProjectRepository {
  async listForOwner(ownerUserId: string): Promise<VeltoProjectApiRecord[]> {
    const client = createServerSupabaseClient();
    const { data, error } = await client
      .from("velto_projects")
      .select(PROJECT_LIST_FIELDS)
      .eq("owner_user_id", ownerUserId)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(`Projects could not be listed: ${error.message}`);
    }

    return (data || []).map(asProjectRecord);
  }

  async getForOwner(
    projectId: string,
    ownerUserId: string,
  ): Promise<VeltoProjectApiRecord | null> {
    const client = createServerSupabaseClient();
    const { data, error } = await client
      .from("velto_projects")
      .select("*")
      .eq("id", projectId)
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();

    if (error) {
      throw new Error(`Project could not be read: ${error.message}`);
    }

    return data ? asProjectRecord(data) : null;
  }

  async getPublicByShareId(
    shareId: string,
  ): Promise<VeltoProjectApiRecord | null> {
    const client = createServerSupabaseClient();
    const { data, error } = await client
      .from("velto_projects")
      .select(PUBLIC_PROJECT_FIELDS)
      .eq("share_id", shareId)
      .eq("is_public", true)
      .maybeSingle();

    if (error) {
      throw new Error(`Public project could not be read: ${error.message}`);
    }

    return data ? asProjectRecord(data) : null;
  }

  async saveForOwner(
    input: SaveVeltoProjectInput,
  ): Promise<SaveVeltoProjectResult> {
    const client = createServerSupabaseClient();
    const payload = projectPayload(input);

    if (input.projectId) {
      const { data, error } = await client
        .from("velto_projects")
        .update(payload)
        .eq("id", input.projectId)
        .eq("owner_user_id", input.ownerUserId)
        .select()
        .maybeSingle();

      if (error) {
        throw new Error(`Project could not be updated: ${error.message}`);
      }

      if (!data) {
        throw new Error("Project was not found or is not owned by this user.");
      }

      return { mode: "updated", project: asProjectRecord(data) };
    }

    const { data, error } = await client
      .from("velto_projects")
      .insert([payload])
      .select()
      .single();

    if (error || !data) {
      throw new Error(
        `Project could not be created: ${error?.message || "unknown error"}`,
      );
    }

    return { mode: "created", project: asProjectRecord(data) };
  }

  async publishForOwner(
    projectId: string,
    ownerUserId: string,
  ): Promise<PublishVeltoProjectResult> {
    const client = createServerSupabaseClient();
    const { data: existingProject, error: existingProjectError } = await client
      .from("velto_projects")
      .select("id, owner_user_id, share_id")
      .eq("id", projectId)
      .maybeSingle();

    if (existingProjectError) {
      throw new Error(
        `Project sharing state could not be read: ${existingProjectError.message}`,
      );
    }

    if (!existingProject) return { status: "not_found" };
    if (existingProject.owner_user_id !== ownerUserId) {
      return { status: "forbidden" };
    }

    let shareId = String(existingProject.share_id || "").trim();

    if (!shareId) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = createShareId();
        const { data: collision, error: collisionError } = await client
          .from("velto_projects")
          .select("id")
          .eq("share_id", candidate)
          .maybeSingle();

        if (collisionError) {
          throw new Error(
            `Share identifier could not be checked: ${collisionError.message}`,
          );
        }

        if (!collision) {
          shareId = candidate;
          break;
        }
      }
    }

    if (!shareId) return { status: "share_id_exhausted" };

    const { data, error } = await client
      .from("velto_projects")
      .update({
        share_id: shareId,
        is_public: true,
        published_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .eq("owner_user_id", ownerUserId)
      .select("id, share_id, is_public, published_at")
      .maybeSingle();

    if (error || !data) {
      throw new Error(
        `Project could not be published: ${error?.message || "unknown error"}`,
      );
    }

    return {
      status: "published",
      shareId,
      project: asProjectRecord(data),
    };
  }
}
