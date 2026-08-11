import type { CreditRepository } from "@/lib/credits/types";
import type { JobQueueRepository } from "./jobs";
import type { ProjectRepository } from "./projects";
import type { ObjectStorageRepository } from "./storage";
import type { CreatorMusicEntitlementRepository, CreatorMusicUsageEventRepository } from "./music";

export type PersistenceServices = {
  creditRepository: CreditRepository;
  objectStorage: ObjectStorageRepository;
  jobQueue: JobQueueRepository;
  projectRepository: ProjectRepository;
  creatorMusicEntitlementRepository: CreatorMusicEntitlementRepository;
  creatorMusicUsageEventRepository: CreatorMusicUsageEventRepository;
};
