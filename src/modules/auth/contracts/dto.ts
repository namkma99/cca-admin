export type AuthUser = {
  id: string;
  username: string;
  role: 'admin' | 'student';
};
export type AuthSession = {
  kind: 'password_setup' | 'authenticated';
  user: AuthUser;
  expiresAt: string;
};
export type SessionResponse = { session: AuthSession | null };
export type AuthErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'ORIGIN_FORBIDDEN'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'BODY_TOO_LARGE'
  | 'INTERNAL_ERROR';
export type ErrorResponse = {
  error: { code: AuthErrorCode; message: string };
  requestId: string;
};
