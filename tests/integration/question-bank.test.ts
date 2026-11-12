import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase } from '../helpers/database';
import {
  examAttempts,
  examCycles,
  questions,
  users,
} from '../../src/server/db/schema';
import { calculateBankVersion } from '../../src/modules/question-bank/server/bank-version';
import { importQuestions } from '../../src/modules/question-bank/server/import-questions';
import { normalizeBank } from '../../src/modules/question-bank/server/normalize';

const q = (id: string, number: number, type = 'single_choice') => ({
  id,
  source: { sheet: 'TEST', row: number + 1, number },
  type,
  prompt: `Prompt ${id}`,
  choices: [
    { id: 'A', text: 'Choice A' },
    { id: 'B', text: 'Choice B' },
  ],
  correctChoiceIds: type === 'multiple_response' ? ['A', 'B'] : ['A'],
  status: 'ready',
});

const bank = (...items: unknown[]) => ({
  schemaVersion: 1,
  topics: [{ id: 'cca-f', questions: items }],
});

describe('question bank normalization and import', () => {
  it('normalizes supported rows and preserves unsupported rows as needs_review', () => {
    const rows = normalizeBank(
      bank(q('cca-f-001', 1), {
        id: 'ccar-p-002',
        source: { number: 2 },
        type: 'unsupported_source_item',
        prompt: null,
        choices: [],
        correctChoiceIds: [],
        status: 'needs_review',
      }),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      topicCode: 'cca-f',
      questionType: 'single_choice',
      status: 'ready',
      sourceNumber: 1,
    });
    expect(rows[1]).toMatchObject({
      questionType: 'unsupported',
      status: 'needs_review',
      prompt: null,
      choices: [],
      correctChoiceIds: [],
    });
  });

  it('rejects duplicate IDs and malformed ready answers', () => {
    expect(() =>
      normalizeBank(bank(q('cca-f-001', 1), q('cca-f-001', 2))),
    ).toThrow();
    const malformed = q('cca-f-002', 2);
    malformed.correctChoiceIds = ['Z'];
    expect(() => normalizeBank(bank(malformed))).toThrow();
    const malformedElement = q('cca-f-003', 3) as unknown as Record<
      string,
      unknown
    >;
    malformedElement.choices = [
      { id: 'A', text: 'ok' },
      { id: 'B', text: 42 },
    ];
    expect(() => normalizeBank(bank(malformedElement))).toThrow();
    const malformedAnswerElement = q('cca-f-004', 4) as unknown as Record<
      string,
      unknown
    >;
    malformedAnswerElement.correctChoiceIds = ['A', 42];
    expect(() => normalizeBank(bank(malformedAnswerElement))).toThrow();
  });

  it('rejects empty banks, duplicate topics and inconsistent source counts', () => {
    expect(() => normalizeBank({ schemaVersion: 1, topics: [] })).toThrow();
    expect(() =>
      normalizeBank({
        schemaVersion: 1,
        topics: [{ id: 'cca-f', questions: [] }],
      }),
    ).toThrow();
    expect(() =>
      normalizeBank({
        schemaVersion: 1,
        topics: [
          { id: 'cca-f', questionCount: 2, questions: [q('cca-f-001', 1)] },
        ],
      }),
    ).toThrow();
    expect(() =>
      normalizeBank({
        schemaVersion: 1,
        topics: [
          { id: 'cca-f', questions: [q('cca-f-001', 1)] },
          { id: 'cca-f', questions: [q('cca-f-002', 2)] },
        ],
      }),
    ).toThrow();
  });

  it('hashes canonical rows independently of input order', () => {
    const a = normalizeBank(bank(q('cca-f-001', 1), q('cca-f-002', 2)));
    const b = normalizeBank(bank(q('cca-f-002', 2), q('cca-f-001', 1)));
    expect(calculateBankVersion(a)).toBe(calculateBankVersion(b));
  });
});

describe('question bank database import', () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => {
    fixture = await createTestDatabase();
  });
  afterAll(async () => {
    await fixture.client.close();
  });
  beforeEach(async () => {
    await fixture.client.exec(
      'TRUNCATE exam_attempts, exam_cycles, questions, users CASCADE',
    );
  });

  it('imports, then returns an idempotent report without replacing rows', async () => {
    const first = await importQuestions(fixture.db, bank(q('cca-f-001', 1)));
    const second = await importQuestions(fixture.db, bank(q('cca-f-001', 1)));
    expect(first).toMatchObject({ imported: 1, ready: 1, changed: true });
    expect(second).toMatchObject({ imported: 1, ready: 1, changed: false });
    expect(await fixture.db.select().from(questions)).toHaveLength(1);
  });

  it('rejects changed replacement while a current cycle exists', async () => {
    await importQuestions(fixture.db, bank(q('cca-f-001', 1)));
    const [user] = await fixture.db
      .insert(users)
      .values({ username: 'u', passwordHash: 'x' })
      .returning();
    expect(user).toBeDefined();
    await fixture.db.insert(examCycles).values({
      userId: user!.id,
      topicCode: 'cca-f',
      seed: 's',
      bankVersion: 'v',
      generatorVersion: 'g',
    });
    await expect(
      importQuestions(fixture.db, bank(q('cca-f-002', 2))),
    ).rejects.toMatchObject({ code: 'BANK_IN_USE' });
    expect(await fixture.db.select().from(questions)).toHaveLength(1);
  });

  it('rejects changed replacement while an attempt is in progress', async () => {
    await importQuestions(fixture.db, bank(q('cca-f-001', 1)));
    const [user] = await fixture.db
      .insert(users)
      .values({ username: 'u2', passwordHash: 'x' })
      .returning();
    expect(user).toBeDefined();
    const [cycle] = await fixture.db
      .insert(examCycles)
      .values({
        userId: user!.id,
        topicCode: 'cca-f',
        seed: 's',
        bankVersion: 'v',
        generatorVersion: 'g',
      })
      .returning();
    expect(cycle).toBeDefined();
    const started = new Date('2026-11-12T12:00:00Z');
    await fixture.db.insert(examAttempts).values({
      cycleId: cycle!.id,
      userId: user!.id,
      formNumber: 1,
      startedAt: started,
      expiresAt: new Date('2026-11-12T14:00:00Z'),
      total: 1,
    });
    await expect(
      importQuestions(fixture.db, bank(q('cca-f-002', 2))),
    ).rejects.toMatchObject({ code: 'BANK_IN_USE' });
  });

  it('replaces after all cycles are closed and detects content-only changes', async () => {
    await importQuestions(fixture.db, bank(q('cca-f-001', 1)));
    const changed = q('cca-f-001', 1);
    changed.prompt = 'A changed synthetic prompt';
    const changedReport = await importQuestions(fixture.db, bank(changed));
    expect(changedReport.changed).toBe(true);
    const [user] = await fixture.db
      .insert(users)
      .values({ username: 'closed', passwordHash: 'x' })
      .returning();
    await fixture.db.insert(examCycles).values({
      userId: user!.id,
      topicCode: 'cca-f',
      seed: 's',
      bankVersion: 'v',
      generatorVersion: 'g',
      closedAt: new Date(),
    });
    const replacement = q('cca-f-002', 2);
    expect((await importQuestions(fixture.db, bank(replacement))).changed).toBe(
      true,
    );
    expect((await fixture.db.select().from(questions))[0]?.id).toBe(
      'cca-f-002',
    );
  });

  it('does not touch existing rows when source validation fails', async () => {
    await importQuestions(fixture.db, bank(q('cca-f-001', 1)));
    await expect(
      importQuestions(fixture.db, {
        schemaVersion: 1,
        topics: [
          {
            id: 'cca-f',
            questions: [
              {
                id: 'bad',
                source: { number: 1 },
                type: 'single_choice',
                status: 'ready',
                prompt: 'bad',
                choices: [
                  { id: 'A', text: 'a' },
                  { id: 'B', text: 'b' },
                ],
                correctChoiceIds: ['Z'],
              },
            ],
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'INVALID_BANK' });
    expect((await fixture.db.select().from(questions))[0]?.id).toBe(
      'cca-f-001',
    );
  });
});
