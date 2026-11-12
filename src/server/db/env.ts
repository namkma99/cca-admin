import { z } from 'zod';

// Do not export environment values; validate lazily when opening a connection.
export const databaseEnvSchema = z.object({
  DATABASE_URL: z.url({
    protocol: /^postgres(?:ql)?$/,
    hostname: /\S+/,
    error: 'A PostgreSQL connection URL with a hostname is required',
  }),
});
