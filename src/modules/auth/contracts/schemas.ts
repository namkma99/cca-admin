import { z } from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9][a-z0-9._-]*$/,
    'Use letters, numbers, periods, underscores or hyphens.',
  );
export const loginSchema = z
  .object({
    username: usernameSchema,
    password: z.string().min(1).max(128).optional(),
  })
  .strict();
export const setupPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, 'Password must contain at least 12 characters.')
      .max(128),
    confirmPassword: z.string().min(1).max(128),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });
export type LoginInput = z.infer<typeof loginSchema>;
export type SetupPasswordInput = z.infer<typeof setupPasswordSchema>;

export const authSessionSchema = z
  .object({
    kind: z.enum(['password_setup', 'authenticated']),
    user: z
      .object({
        id: z.uuid(),
        username: z.string(),
        role: z.enum(['admin', 'student']),
      })
      .strict(),
    expiresAt: z.iso.datetime(),
  })
  .strict();
export const sessionResponseSchema = z
  .object({ session: authSessionSchema.nullable() })
  .strict();

export const loginResponseSchema = z.union([
  z.object({
    session: authSessionSchema,
  }),
  z.object({
    needPassword: z.literal(true),
    username: z.string(),
  }),
]);
export type LoginResponse = z.infer<typeof loginResponseSchema>;
