import 'server-only';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 32768;
const r = 8;
const p = 3;
const verifierPattern =
  /^scrypt\$32768\$8\$3\$([a-f0-9]{32})\$([a-f0-9]{128})$/;
export const DUMMY_PASSWORD_HASH = `scrypt$${N}$${r}$${p}$${'00'.repeat(16)}$${'00'.repeat(64)}`;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N, r, p, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (!password.length || password.length > 128)
    throw new Error('Invalid password length');
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  verifier: string,
): Promise<boolean> {
  const match = verifierPattern.exec(verifier);
  if (!match || !password.length || password.length > 128) return false;
  const salt = Buffer.from(match[1]!, 'hex');
  const expected = Buffer.from(match[2]!, 'hex');
  return timingSafeEqual(await derive(password, salt), expected);
}
