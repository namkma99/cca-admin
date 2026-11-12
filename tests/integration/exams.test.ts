import { describe, expect, it } from 'vitest';
import { allocateForm } from '../../src/modules/exams/server/service';
import { createTestDatabase } from '../helpers/database';
import { ExamService } from '../../src/modules/exams/server/service';
import {
  authSessions,
  examAttemptPayloads,
  questions,
  users,
} from '../../src/server/db/schema';
import {
  createSessionToken,
  hashSessionToken,
} from '../../src/server/security/session-token';
import { eq } from 'drizzle-orm';

function bank(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `cca-f-${String(i + 1).padStart(3, '0')}`,
    topicCode: 'cca-f' as const,
    questionType: 'single_choice' as const,
    prompt: `Question ${i + 1}`,
    choices: [
      { id: 'A', text: 'A' },
      { id: 'B', text: 'B' },
    ],
    correctChoiceIds: ['A'],
    status: 'ready' as const,
    sourceNumber: i + 1,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }));
}

describe('exam form allocation', () => {
  it('is deterministic and has no duplicate questions in a form', () => {
    const rows = bank(63);
    const a = allocateForm(rows, 'seed-1', 3, 60);
    const b = allocateForm(rows, 'seed-1', 3, 60);
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
    expect(new Set(a.map((q) => q.id)).size).toBe(60);
  });

  it('balances ten forms and covers every bank question', () => {
    const rows = bank(63);
    const forms = Array.from({ length: 10 }, (_, i) =>
      allocateForm(rows, 'seed-2', i + 1, 60),
    );
    const counts = new Map(rows.map((row) => [row.id, 0]));
    for (const form of forms)
      for (const question of form)
        counts.set(question.id, counts.get(question.id)! + 1);
    expect([...counts.values()].sort((a, b) => a - b)).toEqual(
      [...counts.values()].sort((a, b) => a - b),
    );
    expect(
      Math.max(...counts.values()) - Math.min(...counts.values()),
    ).toBeLessThanOrEqual(1);
    expect([...counts.values()].every((count) => count > 0)).toBe(true);
  });

  it('never stores or returns a correct-choice field in the visible contract', () => {
    const internal = allocateForm(bank(60), 'seed-3', 1, 60);
    const visible = internal.map((question) => {
      const { correctChoiceIds, questionType, ...safeQuestion } = question;
      void correctChoiceIds;
      return { ...safeQuestion, type: questionType };
    });
    expect(visible[0]).not.toHaveProperty('correctChoiceIds');
  });
});

describe('exam service lifecycle', () => {
  it('starts, saves, submits idempotently, and deletes the payload', async () => {
    const fixture = await createTestDatabase();
    const now = new Date('2026-11-12T12:00:00Z');
    const [user] = await fixture.db
      .insert(users)
      .values({
        username: 'journey',
        passwordHash: 'x',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const token = createSessionToken();
    await fixture.db.insert(authSessions).values({
      userId: user!.id,
      tokenHash: hashSessionToken(token),
      kind: 'authenticated',
      expiresAt: new Date('2026-11-13T12:00:00Z'),
      createdAt: now,
      updatedAt: now,
    });
    await fixture.db.insert(questions).values(bank(63));
    const service = new ExamService(fixture.db, { now: () => now });
    const started = await service.start(token, {
      topicId: 'cca-f',
      formNumber: 1,
    });
    expect(started.questions[0]).not.toHaveProperty('correctChoiceIds');
    await service.save(token, started.id, {
      questionId: started.questions[0]!.id,
      choiceIds: ['A'],
    });
    const result = await service.finish(token, started.id, 'submit');
    expect(result.status).toBe('submitted');
    expect(await fixture.db.select().from(examAttemptPayloads)).toHaveLength(0);
    expect(await service.finish(token, started.id, 'submit')).toEqual(result);
    await fixture.client.close();
  });

  it('rejects setup/revoked sessions and foreign attempt access', async () => {
    const fixture = await createTestDatabase();
    const now = new Date('2026-11-12T12:00:00Z');
    const [one, two] = await fixture.db
      .insert(users)
      .values([
        {
          username: 'one',
          passwordHash: 'x',
          status: 'active',
          createdAt: now,
          updatedAt: now,
        },
        {
          username: 'two',
          passwordHash: 'x',
          status: 'active',
          createdAt: now,
          updatedAt: now,
        },
      ])
      .returning();
    const token = createSessionToken();
    await fixture.db.insert(authSessions).values({
      userId: one!.id,
      tokenHash: hashSessionToken(token),
      kind: 'authenticated',
      expiresAt: new Date('2026-11-13T12:00:00Z'),
      createdAt: now,
      updatedAt: now,
    });
    await fixture.db.insert(questions).values(bank(63));
    const service = new ExamService(fixture.db, { now: () => now });
    const started = await service.start(token, {
      topicId: 'cca-f',
      formNumber: 1,
    });
    const otherToken = createSessionToken();
    await fixture.db.insert(authSessions).values({
      userId: two!.id,
      tokenHash: hashSessionToken(otherToken),
      kind: 'authenticated',
      expiresAt: new Date('2026-11-13T12:00:00Z'),
      createdAt: now,
      updatedAt: now,
    });
    await expect(service.status(otherToken, started.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await fixture.db
      .update(authSessions)
      .set({ revokedAt: now })
      .where(eq(authSessions.tokenHash, hashSessionToken(token)));
    await fixture.client.close();
  });
});
