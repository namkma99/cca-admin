import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

export function validCronSecret(
  header: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || secret.length < 32 || !header?.startsWith('Bearer '))
    return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(secret));
}
