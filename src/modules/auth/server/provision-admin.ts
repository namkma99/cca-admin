import 'server-only';
import { randomBytes } from 'node:crypto';
import { users } from '@/server/db/schema';
import { hashPassword } from '@/server/security/password';
import { usernameSchema } from '../contracts/schemas';
import type { AuthDatabase } from './types';

export async function createAdmin(db: AuthDatabase, username: string) {
  const normalized = usernameSchema.parse(username);
  const temporaryPassword = randomBytes(24).toString('base64url');
  const passwordHash = await hashPassword(temporaryPassword);
  // Unique username makes concurrent calls safe; existing accounts are never overwritten.
  await db.insert(users).values({
    username: normalized,
    passwordHash,
    role: 'admin',
    status: 'pending_password',
  });
  return { username: normalized, temporaryPassword };
}
