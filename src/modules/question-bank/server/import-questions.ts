import 'server-only';
import { eq, isNull, sql } from 'drizzle-orm';
import type { AuthDatabase } from '@/modules/auth/server/types';
import { examAttempts, examCycles, questions } from '@/server/db/schema';
import { AppError } from '@/server/http/errors';
import { calculateBankVersion } from './bank-version';
import { normalizeBank, type CanonicalQuestion } from './normalize';

export type ImportReport = {
  imported: number;
  ready: number;
  needsReview: number;
  changed: boolean;
  bankVersion: string;
};

export async function importQuestions(
  db: AuthDatabase,
  input: unknown,
): Promise<ImportReport> {
  const rows = normalizeBank(input);
  const bankVersion = calculateBankVersion(rows);
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7272026)`);
    const existing = await tx.select().from(questions);
    const existingVersion = calculateBankVersion(
      existing.map((row) => ({
        id: row.id,
        topicCode: row.topicCode,
        questionType: row.questionType,
        prompt: row.prompt,
        choices: row.choices,
        correctChoiceIds: row.correctChoiceIds,
        status: row.status,
        sourceNumber: row.sourceNumber,
      })),
    );
    if (existing.length && existingVersion === bankVersion)
      return report(rows, bankVersion, false);
    if (existing.length) {
      const currentCycles = await tx
        .select({ id: examCycles.id })
        .from(examCycles)
        .where(isNull(examCycles.closedAt))
        .limit(1);
      const activeAttempts = await tx
        .select({ id: examAttempts.id })
        .from(examAttempts)
        .where(eq(examAttempts.status, 'in_progress'))
        .limit(1);
      if (currentCycles.length || activeAttempts.length)
        throw new AppError(
          'BANK_IN_USE',
          409,
          'Question bank cannot be replaced while an exam is active.',
        );
    }
    await tx.delete(questions);
    if (rows.length)
      await tx.insert(questions).values(rows as CanonicalQuestion[]);
    return report(rows, bankVersion, true);
  });
}

function report(
  rows: readonly CanonicalQuestion[],
  bankVersion: string,
  changed: boolean,
): ImportReport {
  return {
    imported: rows.length,
    ready: rows.filter((row) => row.status === 'ready').length,
    needsReview: rows.filter((row) => row.status === 'needs_review').length,
    changed,
    bankVersion,
  };
}
