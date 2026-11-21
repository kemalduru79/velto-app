import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AuthenticatedPrincipal = {
  id: string;
  email: string;
  providerUser: User;
};

export class AuthenticationError extends Error {
  constructor(message = "Geçersiz veya süresi dolmuş oturum.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";

  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

export async function authenticateRequest(
  request: Request,
): Promise<AuthenticatedPrincipal> {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    throw new AuthenticationError("Oturum bilgisi bulunamadı.");
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    throw new AuthenticationError();
  }

  return {
    id: user.id,
    email: user.email || "",
    providerUser: user,
  };
}
