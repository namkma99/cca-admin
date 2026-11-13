import { z } from 'zod';

export const DEFAULT_AUTH_SETTINGS = {
  sessionDurationMinutes: 1440,
  passwordSetupDurationMinutes: 10,
  loginRateLimit: {
    windowMinutes: 15,
    maxAttemptsPerUsername: 10,
    maxAttemptsPerIp: 50,
  },
};

const loginRateLimitInputSchema = z.strictObject({
  windowMinutes: z.number().int().min(1).max(1440),
  maxAttemptsPerUsername: z.number().int().min(1).max(10000),
  maxAttemptsPerIp: z.number().int().min(1).max(10000),
});

const authInputSchema = z.strictObject({
  sessionDurationMinutes: z.number().int().min(1).max(43200),
  passwordSetupDurationMinutes: z.number().int().min(1).max(60),
  loginRateLimit: loginRateLimitInputSchema,
});

const loginRateLimitSchema = loginRateLimitInputSchema.extend({
  windowMinutes: loginRateLimitInputSchema.shape.windowMinutes.default(
    DEFAULT_AUTH_SETTINGS.loginRateLimit.windowMinutes,
  ),
  maxAttemptsPerUsername:
    loginRateLimitInputSchema.shape.maxAttemptsPerUsername.default(
      DEFAULT_AUTH_SETTINGS.loginRateLimit.maxAttemptsPerUsername,
    ),
  maxAttemptsPerIp: loginRateLimitInputSchema.shape.maxAttemptsPerIp.default(
    DEFAULT_AUTH_SETTINGS.loginRateLimit.maxAttemptsPerIp,
  ),
});

export const authSettingsSchema = authInputSchema.extend({
  sessionDurationMinutes: authInputSchema.shape.sessionDurationMinutes.default(
    DEFAULT_AUTH_SETTINGS.sessionDurationMinutes,
  ),
  passwordSetupDurationMinutes:
    authInputSchema.shape.passwordSetupDurationMinutes.default(
      DEFAULT_AUTH_SETTINGS.passwordSetupDurationMinutes,
    ),
  loginRateLimit: loginRateLimitSchema.default(
    DEFAULT_AUTH_SETTINGS.loginRateLimit,
  ),
});

// Update validation intentionally has no defaults: omitted fields must survive.
export const updateAuthSettingsSchema = authInputSchema.partial().extend({
  loginRateLimit: loginRateLimitInputSchema.partial().optional(),
});

export type AuthSettings = z.infer<typeof authSettingsSchema>;
