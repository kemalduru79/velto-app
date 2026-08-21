import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_SERVER_ENVIRONMENT,
  resolveConfiguredValue,
} from "../runtime/coreEnvironment.mjs";

export function resolveServerSupabaseEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
) {
  return {
    url: resolveConfiguredValue(environment, SUPABASE_SERVER_ENVIRONMENT.url),
    anonKey: resolveConfiguredValue(
      environment,
      SUPABASE_SERVER_ENVIRONMENT.anonKey,
    ),
    serviceRoleKey: resolveConfiguredValue(
      environment,
      SUPABASE_SERVER_ENVIRONMENT.serviceRole,
    ),
  };
}

export function createServerSupabaseClient() {
  const { url, serviceRoleKey } = resolveServerSupabaseEnvironment();

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase environment variables eksik.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
