import { z } from 'zod';

export const appSettingsSchema = z.object({
  examDurationMinutes: z.coerce.number().int().min(10).max(300).default(120),
  formCount: z.coerce.number().int().min(1).max(50).default(10),
  passingScorePercentage: z.coerce.number().min(0).max(100).default(70),
  systemName: z.string().trim().min(1).max(100).default('CCA Exam System'),
  allowReviewAnswers: z.boolean().default(true),
});

export const updateSettingsSchema = z.object({
  examDurationMinutes: z.coerce.number().int().min(10).max(300).optional(),
  formCount: z.coerce.number().int().min(1).max(50).optional(),
  passingScorePercentage: z.coerce.number().min(0).max(100).optional(),
  systemName: z.string().trim().min(1).max(100).optional(),
  allowReviewAnswers: z.boolean().optional(),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;
export type UpdateAppSettingsInput = z.infer<typeof updateSettingsSchema>;
