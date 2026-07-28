export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  user: AuthUser;
};

export type SignUpInput = {
  email: string;
  password: string;
  displayName?: string;
  acceptedTermsAt: string;
  emailRedirectTo?: string;
};

export type SignUpResult = {
  user: AuthUser | null;
  session: AuthSession | null;
  requiresEmailVerification: boolean;
};

export interface AuthService {
  signIn(email: string, password: string): Promise<AuthSession>;
  signUp(input: SignUpInput): Promise<SignUpResult>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  getCurrentUser(): Promise<AuthUser | null>;
}
