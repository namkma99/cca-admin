import { expect, it } from 'vitest';
import { readAuthConfig, clientIp } from './auth-config';

it('requires explicit HTTPS production origins and rejects paths/wildcards', () => {
  for (const env of [
    { NODE_ENV: 'production' },
    { NODE_ENV: 'production', APP_ORIGIN: 'http://admin.example.com' },
    { NODE_ENV: 'production', APP_ORIGIN: 'https://admin.example.com/path' },
    {
      NODE_ENV: 'production',
      APP_ORIGIN: 'https://admin.example.com',
      CCA_ALLOWED_ORIGINS: '*',
    },
  ])
    expect(() => readAuthConfig(env)).toThrow();
  expect(readAuthConfig({ NODE_ENV: 'development' }).appOrigin).toBe(
    'http://localhost:3000',
  );
});
it('only trusts client IP headers on Vercel', () => {
  const req = new Request('https://admin.example.com', {
    headers: {
      'x-forwarded-for': '1.2.3.4',
      'x-vercel-forwarded-for': '5.6.7.8',
    },
  });
  expect(clientIp(req, false)).toBe('local');
  expect(clientIp(req, true)).toBe('5.6.7.8');
});

it('allows the production frontend by default but honors an explicit allowlist', () => {
  const env = {
    NODE_ENV: 'production',
    APP_ORIGIN: 'https://cca.dev-pro.online',
  };
  expect(readAuthConfig(env).allowedOrigins.has('https://dev-pro.online')).toBe(
    true,
  );
  const restricted = readAuthConfig({ ...env, CCA_ALLOWED_ORIGINS: '' });
  expect(restricted.allowedOrigins.has('https://dev-pro.online')).toBe(false);
  expect(restricted.allowedOrigins.has(env.APP_ORIGIN)).toBe(true);
});
