import { z } from 'zod';
import { AppError } from './errors';

export const topicSchema = z.enum(['cca-f', 'ccao-f', 'ccar-p']);
export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new AppError('INVALID_INPUT', 400, 'Dữ liệu yêu cầu không hợp lệ.');
  return parsed.data;
}
export const userIdInput = (id: string) => parseInput(z.uuid(), id);
export const startInput = z
  .object({ topicId: topicSchema, formNumber: z.number().int().min(1).max(10) })
  .strict();
export const answerInput = z
  .object({
    questionId: z.string().min(1).max(100),
    choiceIds: z.array(z.string().min(1).max(100)).max(20),
  })
  .strict();
