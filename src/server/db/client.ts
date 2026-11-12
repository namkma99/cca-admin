import 'server-only';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { databaseEnvSchema } from './env';
import * as schema from './schema';

neonConfig.webSocketConstructor = ws;

export type Database = NeonDatabase<typeof schema>;

/** Scope the pool to a request/job. Never return a lazy query or transaction from work. */
export async function withDatabase<T>(
  work: (db: Database) => Promise<T>,
): Promise<T> {
  const result = databaseEnvSchema.safeParse(process.env);
  if (!result.success) {
    // Avoid leaking connection strings or credentials in logs/error responses.
    throw new Error(
      'DATABASE_URL must be configured with a PostgreSQL connection URL.',
    );
  }
  const pool = new Pool({
    connectionString: result.data.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 10000,
  });
  try {
    return await work(drizzle(pool, { schema }));
  } finally {
    await pool.end();
  }
}
