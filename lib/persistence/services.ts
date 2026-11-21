import { createPersistenceServices } from "./factory";
import type { PersistenceServices } from "./types";

let persistenceServices: PersistenceServices | null = null;

export function getPersistenceServices(): PersistenceServices {
  if (!persistenceServices) {
    persistenceServices = createPersistenceServices();
  }

  return persistenceServices;
}

/** Test-only override for adapter contract tests. Do not call from routes. */
export function setPersistenceServicesForTest(
  services: PersistenceServices | null,
) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Persistence services cannot be overridden in production.");
  }

  persistenceServices = services;
}
