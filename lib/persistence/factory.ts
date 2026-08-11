import { SupabaseCreditRepository } from "@/lib/credits/supabaseCreditRepository";
import { SupabaseJobQueueRepository } from "./jobs";
import { SupabaseProjectRepository } from "./projects";
import { SupabaseObjectStorageRepository } from "./storage";
import { SupabaseCreatorMusicEntitlementRepository } from "./music";
import type { PersistenceServices } from "./types";

type DatabaseDriver = "supabase";
type StorageDriver = "supabase";

function databaseDriver(): DatabaseDriver {
  const configured = (process.env.VELTO_DATABASE_DRIVER || "supabase")
    .trim()
    .toLowerCase();

  if (configured !== "supabase") {
    throw new Error(
      `Unsupported VELTO_DATABASE_DRIVER: ${configured}. PORT-P2 currently ships the supabase adapter.`,
    );
  }

  return configured;
}

function storageDriver(): StorageDriver {
  const configured = (process.env.VELTO_STORAGE_DRIVER || "supabase")
    .trim()
    .toLowerCase();

  if (configured !== "supabase") {
    throw new Error(
      `Unsupported VELTO_STORAGE_DRIVER: ${configured}. PORT-P2 currently ships the supabase adapter.`,
    );
  }

  return configured;
}

// VELTO_PORT_P2 — provider selection is centralized here. Azure or another
// backend can be added as a new adapter without changing API routes.
export function createPersistenceServices(): PersistenceServices {
  const database = databaseDriver();
  const storage = storageDriver();

  if (database === "supabase" && storage === "supabase") {
    return {
      creditRepository: new SupabaseCreditRepository(),
      objectStorage: new SupabaseObjectStorageRepository(),
      jobQueue: new SupabaseJobQueueRepository(),
      projectRepository: new SupabaseProjectRepository(),
      creatorMusicEntitlementRepository: new SupabaseCreatorMusicEntitlementRepository(),
    };
  }

  throw new Error("No persistence service combination is configured.");
}
