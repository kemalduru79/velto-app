import { resolveRuntimeRelease as resolveRuntimeReleaseCore } from "./releaseIdentity.mjs";

export function resolveRuntimeRelease(
  environment: NodeJS.ProcessEnv = process.env,
) {
  return resolveRuntimeReleaseCore(environment);
}
