import { createHash } from 'node:crypto';
import type { CanonicalQuestion } from './normalize';

export function calculateBankVersion(
  rows: readonly CanonicalQuestion[],
): string {
  const canonical = [...rows]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((row) => ({
      id: row.id,
      topicCode: row.topicCode,
      questionType: row.questionType,
      prompt: row.prompt,
      choices: row.choices,
      correctChoiceIds: row.correctChoiceIds,
      status: row.status,
      sourceNumber: row.sourceNumber,
    }));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
