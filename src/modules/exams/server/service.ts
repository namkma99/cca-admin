import 'server-only';
import { and, asc, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';
import { calculateBankVersion } from '@/modules/question-bank/server/bank-version';
import {
  authSessions,
  examAttemptPayloads,
  examAttempts,
  examCycles,
  questions,
  users,
} from '@/server/db/schema';
import { AppError } from '@/server/http/errors';
import {
  hashSessionToken,
  SESSION_TOKEN_PATTERN,
} from '@/server/security/session-token';
import type { AuthDatabase } from '@/modules/auth/server/types';
import type {
  Attempt,
  Catalog,
  Dashboard,
  Question,
  Summary,
  TopicId,
} from '../contracts/dto';

export const EXAM_DURATION_MINUTES = 120;
export const FORM_COUNT = 10;
const DURATION_MS = EXAM_DURATION_MINUTES * 60 * 1000;
const GENERATOR_VERSION = 'exam-generator-v1';
const TOPICS = [
  { id: 'cca-f' as const, title: 'CCA-F', questionsPerExam: 60 },
  { id: 'ccao-f' as const, title: 'CCAO-F', questionsPerExam: 60 },
  { id: 'ccar-p' as const, title: 'CCAR-P', questionsPerExam: 63 },
];
type Tx = Parameters<Parameters<AuthDatabase['transaction']>[0]>[0];
type Snapshot = Array<{
  id: string;
  questionType: 'single_choice' | 'multiple_response';
  prompt: string;
  choices: { id: string; text: string }[];
  correctChoiceIds: string[];
}>;
const fail = (code: string, status: number, message: string): never => {
  throw new AppError(code, status, message);
};
const epoch = (d: Date) => d.getTime();
const topic = (id: TopicId) => TOPICS.find((x) => x.id === id)!;

export function allocateForm(
  rows: (typeof questions.$inferSelect)[],
  seed: string,
  form: number,
  total: number,
): Snapshot {
  const ordered = [...rows].sort((a, b) =>
    createHash('sha256')
      .update(`${seed}:${a.id}`)
      .digest('hex')
      .localeCompare(
        createHash('sha256').update(`${seed}:${b.id}`).digest('hex'),
      ),
  );
  if (ordered.length < total)
    fail('QUESTION_BANK_INSUFFICIENT', 409, 'Ngân hàng câu hỏi chưa đủ.');
  return Array.from({ length: total }, (_, i) => {
    const q = ordered[((form - 1) * total + i) % ordered.length]!;
    return {
      id: q.id,
      questionType: q.questionType as Snapshot[number]['questionType'],
      prompt: q.prompt!,
      choices: q.choices,
      correctChoiceIds: q.correctChoiceIds,
    };
  });
}
function visible(s: Snapshot): Question[] {
  return s.map((q) => ({
    id: q.id,
    type: q.questionType,
    prompt: q.prompt,
    choices: q.choices,
    requiredSelectionCount:
      q.questionType === 'single_choice' ? 1 : q.correctChoiceIds.length,
  }));
}
function marks(s: Snapshot, a: Record<string, string[]>) {
  if (!s.length) fail('INVALID_ATTEMPT', 500, 'Bài thi không có câu hỏi.');
  let correct = 0,
    unanswered = 0;
  for (const q of s) {
    const got = a[q.id];
    if (!got?.length) {
      unanswered++;
      continue;
    }
    const x = [...new Set(got)].sort(),
      y = [...new Set(q.correctChoiceIds)].sort();
    if (x.length === y.length && x.every((v, i) => v === y[i])) correct++;
  }
  const wrong = s.length - correct - unanswered;
  return {
    correct,
    wrong,
    unanswered,
    simulatedScore: Math.round(100 + (900 * correct) / s.length),
  };
}
function summary(
  a: typeof examAttempts.$inferSelect,
  topicId: TopicId,
): Summary {
  const status = a.status as Summary['status'];
  return {
    id: a.id,
    topicId,
    formNumber: a.formNumber,
    status,
    startedAt: epoch(a.startedAt),
    endedAt: epoch(a.endedAt!),
    finalizedAt: epoch(a.finalizedAt!),
    total: a.total,
    correct: a.correct!,
    wrong: a.wrong!,
    unanswered: a.unanswered!,
    simulatedScore: a.simulatedScore!,
    percent: Math.round((a.correct! / a.total) * 10000) / 100,
    reason:
      status === 'timed_out'
        ? 'timeout'
        : status === 'abandoned'
          ? 'abandoned'
          : 'submitted',
  };
}
function canonical(rows: (typeof questions.$inferSelect)[]) {
  return rows.map((q) => ({
    id: q.id,
    topicCode: q.topicCode,
    questionType: q.questionType,
    prompt: q.prompt,
    choices: q.choices,
    correctChoiceIds: q.correctChoiceIds,
    status: q.status,
    sourceNumber: q.sourceNumber,
  }));
}

export class ExamService {
  private readonly now: () => Date;
  constructor(
    private readonly db: AuthDatabase,
    options: { now?: () => Date } = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }
  private async auth(token: string | null, role?: 'admin' | 'student') {
    if (!token || !SESSION_TOKEN_PATTERN.test(token))
      fail(
        'UNAUTHENTICATED',
        401,
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      );
    const [r] = await this.db
      .select({ u: users, s: authSessions })
      .from(authSessions)
      .innerJoin(users, eq(users.id, authSessions.userId))
      .where(eq(authSessions.tokenHash, hashSessionToken(token!)))
      .limit(1);
    const n = this.now();
    if (
      !r ||
      r.s.kind !== 'authenticated' ||
      r.s.revokedAt ||
      r.s.expiresAt <= n ||
      r.u.status !== 'active'
    )
      fail(
        'UNAUTHENTICATED',
        401,
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      );
    if (role && r!.u.role !== role)
      fail('FORBIDDEN', 403, 'Bạn không có quyền thực hiện thao tác này.');
    return r!.u;
  }
  private async lockUser(
    tx: Tx,
    token: string | null,
    role?: 'admin' | 'student',
  ) {
    if (!token || !SESSION_TOKEN_PATTERN.test(token))
      fail(
        'UNAUTHENTICATED',
        401,
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      );
    const hash = hashSessionToken(token!);
    const [old] = await tx
      .select()
      .from(authSessions)
      .where(eq(authSessions.tokenHash, hash))
      .limit(1);
    if (!old)
      fail(
        'UNAUTHENTICATED',
        401,
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      );
    const [u] = await tx
      .select()
      .from(users)
      .where(eq(users.id, old!.userId))
      .for('update');
    const [s] = await tx
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, old!.id))
      .limit(1);
    const n = this.now();
    if (
      !u ||
      !s ||
      s.kind !== 'authenticated' ||
      s.revokedAt ||
      s.expiresAt <= n ||
      u.status !== 'active'
    )
      fail(
        'UNAUTHENTICATED',
        401,
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      );
    if (role && u!.role !== role)
      fail('FORBIDDEN', 403, 'Bạn không có quyền thực hiện thao tác này.');
    return { u, s };
  }
  async finalize(
    tx: Tx,
    a: typeof examAttempts.$inferSelect,
    n: Date,
    status: 'submitted' | 'abandoned' | 'timed_out',
  ) {
    const [p] = await tx
      .select()
      .from(examAttemptPayloads)
      .where(eq(examAttemptPayloads.attemptId, a.id))
      .for('update');
    const result = marks(
      (p?.questionSnapshot ?? []) as Snapshot,
      (p?.answers ?? {}) as Record<string, string[]>,
    );
    const [out] = await tx
      .update(examAttempts)
      .set({
        status,
        endedAt:
          status === 'timed_out'
            ? a.expiresAt
            : new Date(Math.min(n.getTime(), a.expiresAt.getTime())),
        finalizedAt: n,
        ...result,
        updatedAt: n,
      })
      .where(
        and(eq(examAttempts.id, a.id), eq(examAttempts.status, 'in_progress')),
      )
      .returning();
    await tx
      .delete(examAttemptPayloads)
      .where(eq(examAttemptPayloads.attemptId, a.id));
    return out ?? a;
  }
  async catalog(token: string | null): Promise<Catalog> {
    const u = await this.auth(token);
    const used = await this.db
      .select({ topic: examCycles.topicCode, form: examAttempts.formNumber })
      .from(examAttempts)
      .innerJoin(examCycles, eq(examCycles.id, examAttempts.cycleId))
      .where(and(eq(examAttempts.userId, u.id), isNull(examCycles.closedAt)));
    return {
      topics: TOPICS.map((t) => {
        const forms = [
          ...new Set(used.filter((x) => x.topic === t.id).map((x) => x.form)),
        ].sort((a, b) => a - b);
        return {
          id: t.id,
          title: t.title,
          questionCount: 0,
          excludedCount: 0,
          questionsPerExam: t.questionsPerExam,
          durationMinutes: EXAM_DURATION_MINUTES,
          formCount: FORM_COUNT,
          forms: FORM_COUNT,
          usedForms: forms,
          availableForms: Array.from({ length: 10 }, (_, i) => i + 1).filter(
            (x) => !forms.includes(x),
          ),
        };
      }),
    };
  }
  async dashboard(token: string | null): Promise<Dashboard> {
    const u = await this.auth(token);
    const cycles = await this.db
      .select()
      .from(examCycles)
      .where(and(eq(examCycles.userId, u.id), isNull(examCycles.closedAt)));
    const rows = await this.db
      .select({ a: examAttempts, c: examCycles })
      .from(examAttempts)
      .innerJoin(examCycles, eq(examCycles.id, examAttempts.cycleId))
      .where(and(eq(examAttempts.userId, u.id), isNull(examCycles.closedAt)))
      .orderBy(desc(examAttempts.startedAt));
    const active = rows.find((x) => x.a.status === 'in_progress');
    return {
      results: rows
        .filter((x) => x.a.status !== 'in_progress')
        .slice(0, 30)
        .map((x) => summary(x.a, x.c.topicCode as TopicId)),
      cycles: cycles.map((c) => ({
        topicId: c.topicCode as TopicId,
        usedForms: rows
          .filter((x) => x.c.id === c.id)
          .map((x) => x.a.formNumber)
          .sort((a, b) => a - b),
        activeAttemptId:
          rows.find((x) => x.c.id === c.id && x.a.status === 'in_progress')?.a
            .id ?? null,
      })),
      activeAttemptId: active?.a.id ?? null,
    };
  }
  async start(
    token: string | null,
    input: { topicId: TopicId; formNumber: number },
  ): Promise<Attempt> {
    await this.auth(token);
    if (
      !TOPICS.some((t) => t.id === input?.topicId) ||
      !Number.isInteger(input?.formNumber) ||
      input.formNumber < 1 ||
      input.formNumber > 10
    )
      fail('INVALID_INPUT', 400, 'Đề thi không hợp lệ.');
    const outcome = (await this.db.transaction(async (tx) => {
      const { u, s } = await this.lockUser(tx, token);
      const n = this.now();
      if (s!.expiresAt.getTime() - n.getTime() < DURATION_MS)
        fail(
          'SESSION_TOO_SHORT',
          409,
          'Phiên đăng nhập không đủ thời gian cho một bài thi.',
        );
      const [active] = await tx
        .select()
        .from(examAttempts)
        .where(
          and(
            eq(examAttempts.userId, u!.id),
            eq(examAttempts.status, 'in_progress'),
          ),
        )
        .for('update');
      if (active && active.expiresAt > n)
        fail('ACTIVE_ATTEMPT', 409, 'Bạn đang có một bài thi đang thực hiện.');
      await tx.execute(sql`select pg_advisory_xact_lock(7272026)`);
      const rows = await tx
        .select()
        .from(questions)
        .where(eq(questions.topicCode, input.topicId));
      const version = calculateBankVersion(canonical(rows) as never);
      const ready = rows.filter((q) => q.status === 'ready');
      const t = topic(input.topicId);
      if (ready.length < t.questionsPerExam)
        fail('QUESTION_BANK_INSUFFICIENT', 409, 'Ngân hàng câu hỏi chưa đủ.');
      let [cycle] = await tx
        .select()
        .from(examCycles)
        .where(
          and(
            eq(examCycles.userId, u!.id),
            eq(examCycles.topicCode, input.topicId),
            isNull(examCycles.closedAt),
          ),
        )
        .for('update');
      if (!cycle)
        [cycle] = await tx
          .insert(examCycles)
          .values({
            userId: u!.id,
            topicCode: input.topicId,
            seed: randomUUID(),
            bankVersion: version,
            generatorVersion: GENERATOR_VERSION,
            createdAt: n,
            updatedAt: n,
          })
          .returning();
      if (
        !cycle ||
        cycle.bankVersion !== version ||
        cycle.generatorVersion !== GENERATOR_VERSION
      )
        fail('BANK_VERSION_DRIFT', 409, 'Ngân hàng câu hỏi đã thay đổi.');
      const [used] = await tx
        .select()
        .from(examAttempts)
        .where(
          and(
            eq(examAttempts.cycleId, cycle!.id),
            eq(examAttempts.formNumber, input.formNumber),
          ),
        )
        .limit(1);
      if (used) {
        if (active) {
          await this.finalize(tx, active, n, 'timed_out');
          return { error: 'FORM_USED' as const };
        }
        fail('FORM_USED', 409, 'Đề thi này đã được sử dụng.');
      }
      if (active) await this.finalize(tx, active, n, 'timed_out');
      const snap = allocateForm(
          ready,
          cycle!.seed,
          input.formNumber,
          t.questionsPerExam,
        ),
        expires = new Date(n.getTime() + DURATION_MS);
      const [a] = await tx
        .insert(examAttempts)
        .values({
          cycleId: cycle!.id,
          userId: u!.id,
          formNumber: input.formNumber,
          status: 'in_progress',
          startedAt: n,
          expiresAt: expires,
          total: t.questionsPerExam,
          createdAt: n,
          updatedAt: n,
        })
        .returning();
      if (!a) throw new Error('Attempt creation failed');
      await tx.insert(examAttemptPayloads).values({
        attemptId: a.id,
        questionSnapshot: snap,
        answers: {},
        updatedAt: n,
      });
      return {
        id: a.id,
        topicId: input.topicId,
        formNumber: a.formNumber,
        status: 'in_progress' as const,
        startedAt: epoch(n),
        expiresAt: epoch(expires),
        serverNow: epoch(n),
        questions: visible(snap),
      };
    })) as Attempt | { error: 'FORM_USED' };
    if ('error' in outcome) {
      fail('FORM_USED', 409, 'Đề thi này đã được sử dụng.');
    }
    return outcome as Attempt;
  }
  async save(
    token: string | null,
    id: string,
    input: { questionId: string; choiceIds: string[] },
  ): Promise<{ ok: true }> {
    let expired = false;
    await this.db.transaction(async (tx) => {
      const { u } = await this.lockUser(tx, token);
      const [a] = await tx
        .select()
        .from(examAttempts)
        .where(and(eq(examAttempts.id, id), eq(examAttempts.userId, u!.id)))
        .for('update');
      if (!a || a.status !== 'in_progress')
        fail('NOT_FOUND', 404, 'Bài thi không tồn tại.');
      const [p] = await tx
        .select()
        .from(examAttemptPayloads)
        .where(eq(examAttemptPayloads.attemptId, id))
        .for('update');
      if (!p) fail('NOT_FOUND', 404, 'Bài thi không tồn tại.');
      const n = this.now();
      if (a!.expiresAt <= n) {
        await this.finalize(tx, a!, n, 'timed_out');
        expired = true;
        return;
      }
      if (
        !Array.isArray(input?.choiceIds) ||
        new Set(input.choiceIds).size !== input.choiceIds.length
      )
        fail('INVALID_INPUT', 400, 'Lựa chọn không hợp lệ.');
      const q = (p!.questionSnapshot as Snapshot).find(
        (x) => x.id === input.questionId,
      );
      if (
        !q ||
        input.choiceIds.some((c) => !q.choices.some((x) => x.id === c)) ||
        (q.questionType === 'single_choice' && input.choiceIds.length > 1)
      )
        fail('INVALID_INPUT', 400, 'Lựa chọn không hợp lệ.');
      await tx
        .update(examAttemptPayloads)
        .set({
          answers: {
            ...(p!.answers as Record<string, string[]>),
            [input.questionId]: input.choiceIds,
          },
          updatedAt: n,
        })
        .where(eq(examAttemptPayloads.attemptId, id));
    });
    if (expired) fail('ATTEMPT_EXPIRED', 409, 'Bài thi đã hết thời gian.');
    return { ok: true };
  }
  async status(
    token: string | null,
    id: string,
  ): Promise<
    | Attempt
    | Summary
    | { status: 'active'; serverNow: number; expiresAt: number }
  > {
    const u = await this.auth(token);
    const [r] = await this.db
      .select({ a: examAttempts, c: examCycles, p: examAttemptPayloads })
      .from(examAttempts)
      .innerJoin(examCycles, eq(examCycles.id, examAttempts.cycleId))
      .leftJoin(
        examAttemptPayloads,
        eq(examAttemptPayloads.attemptId, examAttempts.id),
      )
      .where(and(eq(examAttempts.id, id), eq(examAttempts.userId, u!.id)))
      .limit(1);
    if (!r) fail('NOT_FOUND', 404, 'Bài thi không tồn tại.');
    if (r!.a.status !== 'in_progress')
      return summary(r!.a, r!.c.topicCode as TopicId);
    const n = this.now();
    if (r!.a.expiresAt <= n) {
      await this.db.transaction(async (tx) => {
        const { u: lu } = await this.lockUser(tx, token);
        const [a] = await tx
          .select()
          .from(examAttempts)
          .where(and(eq(examAttempts.id, id), eq(examAttempts.userId, lu!.id)))
          .for('update');
        if (a?.status === 'in_progress' && a.expiresAt <= this.now())
          await this.finalize(tx, a, this.now(), 'timed_out');
      });
      return this.status(token, id);
    }
    return {
      status: 'active',
      serverNow: epoch(n),
      expiresAt: epoch(r!.a.expiresAt),
    };
  }
  async finish(
    token: string | null,
    id: string,
    action: 'submit' | 'abandon',
  ): Promise<Summary> {
    if (action !== 'submit' && action !== 'abandon')
      fail('INVALID_INPUT', 400, 'Thao tác không hợp lệ.');
    return this.db.transaction(async (tx) => {
      const { u } = await this.lockUser(tx, token);
      const [a] = await tx
        .select()
        .from(examAttempts)
        .where(and(eq(examAttempts.id, id), eq(examAttempts.userId, u!.id)))
        .for('update');
      if (!a) fail('NOT_FOUND', 404, 'Bài thi không tồn tại.');
      const [c] = await tx
        .select()
        .from(examCycles)
        .where(eq(examCycles.id, a!.cycleId))
        .for('update');
      if (!c) fail('NOT_FOUND', 404, 'Bài thi không tồn tại.');
      if (a!.status !== 'in_progress')
        return summary(a!, c!.topicCode as TopicId);
      const n = this.now(),
        status =
          a!.expiresAt <= n
            ? 'timed_out'
            : action === 'abandon'
              ? 'abandoned'
              : 'submitted';
      return summary(
        await this.finalize(tx, a!, n, status),
        c!.topicCode as TopicId,
      );
    });
  }
  async resetTopic(
    token: string | null,
    userId: string,
    topicId: TopicId,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const { u } = await this.lockUser(tx, token, 'admin');
      const [target] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .for('update');
      if (!target) fail('NOT_FOUND', 404, 'Người dùng không tồn tại.');
      const [c] = await tx
        .select()
        .from(examCycles)
        .where(
          and(
            eq(examCycles.userId, userId),
            eq(examCycles.topicCode, topicId),
            isNull(examCycles.closedAt),
          ),
        )
        .for('update');
      if (c) {
        const [a] = await tx
          .select()
          .from(examAttempts)
          .where(
            and(
              eq(examAttempts.cycleId, c.id),
              eq(examAttempts.status, 'in_progress'),
            ),
          )
          .for('update');
        if (a)
          await this.finalize(
            tx,
            a,
            this.now(),
            a.expiresAt <= this.now() ? 'timed_out' : 'abandoned',
          );
        await tx
          .update(examCycles)
          .set({ closedAt: this.now(), updatedAt: this.now() })
          .where(eq(examCycles.id, c.id));
      }
      await tx.execute(
        sql`insert into admin_audit_logs (actor_user_id,target_user_id,action,metadata,created_at) values (${u!.id},${userId},'reset_exam_cycle',${JSON.stringify({ topicId })}::jsonb,${this.now()})`,
      );
    });
  }
  async history(token: string | null, userId: string) {
    await this.auth(token, 'admin');
    const cs = await this.db
      .select()
      .from(examCycles)
      .where(eq(examCycles.userId, userId))
      .orderBy(desc(examCycles.createdAt));
    if (!cs.length) {
      const [x] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId));
      if (!x) fail('NOT_FOUND', 404, 'Người dùng không tồn tại.');
    }
    const rs = await this.db
      .select({ a: examAttempts, c: examCycles })
      .from(examAttempts)
      .innerJoin(examCycles, eq(examCycles.id, examAttempts.cycleId))
      .where(eq(examAttempts.userId, userId))
      .orderBy(desc(examAttempts.startedAt))
      .limit(200);
    return {
      cycles: cs.map((c) => ({
        id: c.id,
        topicId: c.topicCode as TopicId,
        closedAt: c.closedAt ? epoch(c.closedAt) : null,
      })),
      results: rs
        .filter((x) => x.a.status !== 'in_progress')
        .map((x) => ({
          ...summary(x.a, x.c.topicCode as TopicId),
          cycleId: x.c.id,
        })),
    };
  }
  async cleanupExpired(limit = 50) {
    const rows = await this.db
      .select()
      .from(examAttempts)
      .where(
        and(
          eq(examAttempts.status, 'in_progress'),
          lt(examAttempts.expiresAt, this.now()),
        ),
      )
      .orderBy(asc(examAttempts.expiresAt))
      .limit(limit);
    let count = 0;
    for (const row of rows)
      await this.db.transaction(async (tx) => {
        await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, row.userId))
          .for('update');
        const [a] = await tx
          .select()
          .from(examAttempts)
          .where(
            and(
              eq(examAttempts.id, row.id),
              eq(examAttempts.status, 'in_progress'),
            ),
          )
          .for('update');
        if (a && a.expiresAt <= this.now()) {
          await tx
            .select({ id: examCycles.id })
            .from(examCycles)
            .where(eq(examCycles.id, a.cycleId))
            .for('update');
          await this.finalize(tx, a, this.now(), 'timed_out');
          count++;
        }
      });
    return count;
  }
}
export async function finalizeActiveForUser(tx: Tx, userId: string, now: Date) {
  const [a] = await tx
    .select()
    .from(examAttempts)
    .where(
      and(
        eq(examAttempts.userId, userId),
        eq(examAttempts.status, 'in_progress'),
      ),
    )
    .for('update');
  if (!a) return null;
  const [c] = await tx
    .select()
    .from(examCycles)
    .where(eq(examCycles.id, a.cycleId))
    .for('update');
  if (!c) return null;
  return new ExamService(tx as never, { now: () => now }).finalize(
    tx,
    a,
    now,
    a.expiresAt <= now ? 'timed_out' : 'abandoned',
  );
}
