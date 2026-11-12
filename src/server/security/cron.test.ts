import { expect, it } from 'vitest';
import { validCronSecret } from './cron';
it('requires configured high-entropy bearer secret and rejects malformed auth', () => {
  const secret = 'a'.repeat(40);
  expect(validCronSecret(`Bearer ${secret}`, secret)).toBe(true);
  for (const header of [null, '', secret, `Bearer ${secret}x`, 'Bearer wrong'])
    expect(validCronSecret(header, secret)).toBe(false);
  expect(validCronSecret('Bearer x', 'x')).toBe(false);
  expect(validCronSecret('Bearer undefined', undefined)).toBe(false);
});
