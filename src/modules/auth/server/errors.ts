import type { AuthErrorCode } from '../contracts/dto';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    public readonly status: number,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
export const unauthenticated = () =>
  new AuthError(
    'UNAUTHENTICATED',
    401,
    'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
  );
export const forbidden = () =>
  new AuthError('FORBIDDEN', 403, 'Bạn không có quyền thực hiện thao tác này.');
