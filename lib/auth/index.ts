import { SupabaseAuthAdapter } from "./supabaseAuthAdapter";

export type {
  AuthService,
  AuthSession,
  AuthUser,
  SignUpInput,
  SignUpResult,
} from "./types";

export const authService = new SupabaseAuthAdapter();
