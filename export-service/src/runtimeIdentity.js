export function resolveRuntimeRelease(environment = process.env) {
  const release = environment.VELTO_RELEASE?.trim();
  if (release) return release;

  const vercelCommit = environment.VERCEL_GIT_COMMIT_SHA?.trim();
  if (vercelCommit) return vercelCommit.slice(0, 12);

  const gitCommit = environment.GIT_COMMIT_SHA?.trim();
  if (gitCommit) return gitCommit.slice(0, 12);

  return environment.NEXT_PUBLIC_APP_VERSION?.trim() || "local";
}
