import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readFile, readdir } from 'node:fs/promises';
import * as schema from '../../src/server/db/schema';

export async function createTestDatabase() {
  const client = new PGlite();
  const directory = new URL('../../drizzle/', import.meta.url);
  for (const file of (await readdir(directory))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    await client.exec(await readFile(new URL(file, directory), 'utf8'));
  }
  return { client, db: drizzle(client, { schema }) };
}
