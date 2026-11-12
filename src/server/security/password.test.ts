import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';
import { createSessionToken, hashSessionToken } from './session-token';

describe('password verifier', () => {
  it('salts hashes and verifies the exact password without trimming', async () => {
    const password = '  My secure password  ';
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword(password.trim(), first)).toBe(false);
    expect(await verifyPassword('incorrect', first)).toBe(false);
  });
  it('rejects malformed/unsupported hash parameters instead of allocating unbounded memory', async () => {
    for (const value of [
      '',
      'scrypt$1$1$1$bad$bad',
      'scrypt$1073741824$8$3$deadbeef$deadbeef',
    ]) {
      expect(await verifyPassword('password', value)).toBe(false);
    }
  });
});

describe('session tokens', () => {
  it('generates random 256-bit tokens and deterministic hashes', () => {
    const token = createSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createSessionToken()).not.toBe(token);
    expect(hashSessionToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toBe(token);
  });
});
