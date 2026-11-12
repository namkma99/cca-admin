import 'server-only';
import { createHash, randomBytes } from 'node:crypto';

export const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const createSessionToken = () => randomBytes(32).toString('base64url');
export const hashSessionToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');
