import { describe, expect, it } from 'vitest';
import { databaseEnvSchema } from './env';

describe('database environment', () => {
  it('rejects missing credentials and non-PostgreSQL URLs', () => {
    expect(databaseEnvSchema.safeParse({}).success).toBe(false);
    expect(
      databaseEnvSchema.safeParse({ DATABASE_URL: 'https://example.com' })
        .success,
    ).toBe(false);
  });
  it.each(['', 'not-a-url', 'postgresql://'])(
    'rejects malformed URL %j without throwing',
    (value) => {
      expect(databaseEnvSchema.safeParse({ DATABASE_URL: value }).success).toBe(
        false,
      );
    },
  );
  it('accepts PostgreSQL connection strings', () => {
    expect(
      databaseEnvSchema.safeParse({
        DATABASE_URL: 'postgresql://user:pass@localhost/test',
      }).success,
    ).toBe(true);
    expect(
      databaseEnvSchema.safeParse({
        DATABASE_URL: 'postgres://user:pass@localhost/test',
      }).success,
    ).toBe(true);
  });
});
