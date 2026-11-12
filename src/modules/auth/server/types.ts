import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from '@/server/db/schema';

// Shared SQL interface for Neon in production and PostgreSQL embedded in tests.
export type AuthDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;
