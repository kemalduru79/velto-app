import type { CreditRepository } from "@/lib/credits/types";
import type { JobQueueRepository } from "./jobs";
import type { ProjectRepository } from "./projects";
import type { ObjectStorageRepository } from "./storage";

export type PersistenceServices = {
  creditRepository: CreditRepository;
  objectStorage: ObjectStorageRepository;
  jobQueue: JobQueueRepository;
  projectRepository: ProjectRepository;
};
