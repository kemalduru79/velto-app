import { SupabaseCreditRepository } from "@/lib/credits/supabaseCreditRepository";
import type { CreditRepository } from "@/lib/credits/types";
import { SupabaseObjectStorageRepository } from "./storage";
import type { ObjectStorageRepository } from "./storage";

export type PersistenceServices = {
  creditRepository: CreditRepository;
  objectStorage: ObjectStorageRepository;
};

let persistenceServices: PersistenceServices | null = null;

export function getPersistenceServices(): PersistenceServices {
  if (!persistenceServices) {
    persistenceServices = {
      creditRepository: new SupabaseCreditRepository(),
      objectStorage: new SupabaseObjectStorageRepository(),
    };
  }

  return persistenceServices;
}
