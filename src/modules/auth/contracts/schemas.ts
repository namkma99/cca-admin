import { z } from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9][a-z0-9._-]*$/,
    'Username chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.',
  );
export const loginSchema = z
  .object({
    username: usernameSchema,
    password: z.string().min(1).max(128),
  })
  .strict();
export const setupPasswordSchema = z
  .object({
    password: z.string().min(12, 'Mật khẩu cần ít nhất 12 ký tự.').max(128),
    confirmPassword: z.string().min(1).max(128),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Xác nhận mật khẩu chưa khớp.',
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
