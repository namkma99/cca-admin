import 'server-only';
import { users } from '@/server/db/schema';
import { usernameSchema } from '../contracts/schemas';
import type { AuthDatabase } from './types';

export async function createAdmin(db: AuthDatabase, username: string) {
  const normalized = usernameSchema.parse(username);
  // Unique username makes concurrent calls safe; existing accounts are never overwritten.
  await db.insert(users).values({
    username: normalized,
    passwordHash: null,
    role: 'admin',
    status: 'pending_password',
  });
  return { username: normalized };
}
