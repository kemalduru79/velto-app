import { SupabaseCreditRepository } from "@/lib/credits/supabaseCreditRepository";
import type { CreditRepository } from "@/lib/credits/types";
import { SupabaseJobQueueRepository } from "./jobs";
import type { JobQueueRepository } from "./jobs";
import { SupabaseObjectStorageRepository } from "./storage";
import type { ObjectStorageRepository } from "./storage";

export type PersistenceServices = {
  creditRepository: CreditRepository;
  objectStorage: ObjectStorageRepository;
  jobQueue: JobQueueRepository;
};

let persistenceServices: PersistenceServices | null = null;

export function getPersistenceServices(): PersistenceServices {
  if (!persistenceServices) {
    persistenceServices = {
      creditRepository: new SupabaseCreditRepository(),
      objectStorage: new SupabaseObjectStorageRepository(),
      jobQueue: new SupabaseJobQueueRepository(),
    };
  }

  return persistenceServices;
}
