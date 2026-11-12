import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

// Generate/check need no credentials. Only migration connects to the configured DB.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema/index.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
  ...(process.env.DATABASE_URL
    ? { dbCredentials: { url: process.env.DATABASE_URL } }
    : {}),
});
