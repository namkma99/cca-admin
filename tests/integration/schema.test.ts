import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

const db = new PGlite();
const alice = '00000000-0000-4000-8000-000000000001';
const bob = '00000000-0000-4000-8000-000000000002';
let cycleId: string;

async function rejectSql(sql: string, code: string, params: unknown[] = []) {
  await db.exec('SAVEPOINT rejected_write');
  try {
    await expect(db.query(sql, params)).rejects.toMatchObject({ code });
  } finally {
    await db.exec('ROLLBACK TO SAVEPOINT rejected_write');
    await db.exec('RELEASE SAVEPOINT rejected_write');
  }
}

async function cycle(userId = alice, topic = 'cca-f') {
  const id = randomUUID();
  await db.query(
    `INSERT INTO exam_cycles(id, user_id, topic_code, seed, bank_version, generator_version)
     VALUES ($1, $2, $3, 'seed', 'bank-sha256', 'v1')`,
    [id, userId, topic],
  );
  return id;
}

function insertAttempt(id: string, cycle: string, user = alice, form = 1) {
  return db.query(
    `INSERT INTO exam_attempts(id, cycle_id, user_id, form_number, started_at, expires_at, total)
     VALUES ($1, $2, $3, $4, '2026-11-12T00:00:00Z', '2026-11-12T02:00:00Z', 60)`,
    [id, cycle, user, form],
  );
}

beforeAll(async () => {
  const files = (await readdir(new URL('../../drizzle/', import.meta.url)))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  expect(files.length, 'Initial migration must exist').toBeGreaterThan(0);
  for (const file of files) {
    await db.exec(
      await readFile(new URL(`../../drizzle/${file}`, import.meta.url), 'utf8'),
    );
  }
}, 30000);
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec('BEGIN');
  await db.query(
    `INSERT INTO users(id, username, password_hash, role, status)
     VALUES ($1, 'alice', 'test-verifier', 'student', 'active'),
            ($2, 'bob', 'test-verifier', 'admin', 'active')`,
    [alice, bob],
  );
  cycleId = await cycle();
});
afterEach(async () => {
  await db.exec('ROLLBACK');
});

describe('PostgreSQL migration constraints', () => {
  it('creates exactly the eight application tables', async () => {
    const result = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
    );
    expect(result.rows.map((row) => row.table_name)).toEqual([
      'admin_audit_logs',
      'auth_sessions',
      'exam_attempt_payloads',
      'exam_attempts',
      'exam_cycles',
      'questions',
      'rate_limits',
      'users',
    ]);
  });

  it.each(['Alice', ' alice', 'alice ', ''])(
    'rejects noncanonical username %j',
    async (name) => {
      await rejectSql(
        `INSERT INTO users(username, password_hash) VALUES ($1, 'hash')`,
        '23514',
        [name],
      );
    },
  );

  it('rejects duplicate usernames and unknown roles', async () => {
    await rejectSql(
      `INSERT INTO users(username, password_hash) VALUES ('alice', 'hash')`,
      '23505',
    );
    await rejectSql(`UPDATE users SET role = 'owner' WHERE id = $1`, '23514', [
      alice,
    ]);
  });

  it('enforces session ownership, unique token hashes and positive lifetime', async () => {
    await db.query(
      `INSERT INTO auth_sessions(user_id, token_hash, kind, expires_at) VALUES ($1, 'token', 'authenticated', now() + interval '24 hours')`,
      [alice],
    );
    await rejectSql(
      `INSERT INTO auth_sessions(user_id, token_hash, kind, expires_at) VALUES ($1, 'token', 'authenticated', now() + interval '24 hours')`,
      '23505',
      [bob],
    );
    await rejectSql(
      `INSERT INTO auth_sessions(user_id, token_hash, kind, expires_at) VALUES ($1, 'other', 'authenticated', now() - interval '1 minute')`,
      '23514',
      [alice],
    );
    await rejectSql(
      `INSERT INTO auth_sessions(user_id, token_hash, kind, expires_at) VALUES ($1, 'orphan', 'authenticated', now() + interval '24 hours')`,
      '23503',
      [randomUUID()],
    );
  });

  it('allows incomplete needs_review questions but rejects malformed ready questions', async () => {
    await db.exec(
      `INSERT INTO questions(id, topic_code, question_type, status, source_number) VALUES ('ccar-p-037', 'ccar-p', 'unsupported', 'needs_review', 37)`,
    );
    await rejectSql(
      `UPDATE questions SET status = 'ready' WHERE id = 'ccar-p-037'`,
      '23514',
    );
    await rejectSql(
      `UPDATE questions SET choices = '{}'::jsonb WHERE id = 'ccar-p-037'`,
      '23514',
    );
    await db.exec(`INSERT INTO questions(id, topic_code, question_type, prompt, choices, correct_choice_ids, status, source_number)
      VALUES ('cca-f-001', 'cca-f', 'single_choice', 'Question?', '[{"id":"A","text":"A"},{"id":"B","text":"B"}]', ARRAY['A'], 'ready', 1)`);
    await rejectSql(
      `UPDATE questions SET correct_choice_ids = ARRAY[]::text[] WHERE id = 'cca-f-001'`,
      '23514',
    );
    await rejectSql(
      `UPDATE questions SET correct_choice_ids = ARRAY['A','B'] WHERE id = 'cca-f-001'`,
      '23514',
    );
  });

  it('permits only one current cycle per user/topic while retaining closed cycles', async () => {
    await rejectSql(
      `INSERT INTO exam_cycles(user_id, topic_code, seed, bank_version, generator_version) VALUES ($1, 'cca-f', 's', 'b', 'v1')`,
      '23505',
      [alice],
    );
    await db.query(`UPDATE exam_cycles SET closed_at = now() WHERE id = $1`, [
      cycleId,
    ]);
    await cycle();
    await cycle(alice, 'ccao-f');
  });

  it('rejects attempts referencing another user’s cycle', async () => {
    await rejectSql(
      `INSERT INTO exam_attempts(cycle_id, user_id, form_number, started_at, expires_at, total) VALUES ($1, $2, 1, now(), now() + interval '120 minutes', 60)`,
      '23503',
      [cycleId, bob],
    );
  });

  it('allows only one in-progress attempt per user across topics', async () => {
    await insertAttempt(randomUUID(), cycleId);
    const secondCycle = await cycle(alice, 'ccao-f');
    await rejectSql(
      `INSERT INTO exam_attempts(cycle_id, user_id, form_number, started_at, expires_at, total) VALUES ($1, $2, 1, now(), now() + interval '120 minutes', 60)`,
      '23505',
      [secondCycle, alice],
    );
  });

  it('rejects repeated forms even after the earlier attempt has ended', async () => {
    const id = randomUUID();
    await insertAttempt(id, cycleId);
    await db.query(
      `UPDATE exam_attempts SET status='submitted', ended_at=started_at + interval '1 minute', finalized_at=started_at + interval '1 minute', correct=60, wrong=0, unanswered=0, simulated_score=1000 WHERE id=$1`,
      [id],
    );
    await rejectSql(
      `INSERT INTO exam_attempts(cycle_id, user_id, form_number, started_at, expires_at, total) VALUES ($1, $2, 1, now(), now() + interval '120 minutes', 60)`,
      '23505',
      [cycleId, alice],
    );
    await insertAttempt(randomUUID(), cycleId, alice, 2);
  });

  it('enforces form range, exact deadline and valid totals', async () => {
    await rejectSql(
      `INSERT INTO exam_attempts(cycle_id, user_id, form_number, started_at, expires_at, total) VALUES ($1, $2, 11, now(), now() + interval '120 minutes', 60)`,
      '23514',
      [cycleId, alice],
    );
    await rejectSql(
      `INSERT INTO exam_attempts(cycle_id, user_id, form_number, started_at, expires_at, total) VALUES ($1, $2, 1, now(), now() + interval '121 minutes', 60)`,
      '23514',
      [cycleId, alice],
    );
    await rejectSql(
      `INSERT INTO exam_attempts(cycle_id, user_id, form_number, started_at, expires_at, total) VALUES ($1, $2, 1, now(), now() + interval '120 minutes', 0)`,
      '23514',
      [cycleId, alice],
    );
  });

  it('requires complete consistent summaries and null results during an attempt', async () => {
    const id = randomUUID();
    await insertAttempt(id, cycleId);
    await rejectSql(`UPDATE exam_attempts SET correct=0 WHERE id=$1`, '23514', [
      id,
    ]);
    await rejectSql(
      `UPDATE exam_attempts SET status='submitted', ended_at=expires_at, finalized_at=expires_at WHERE id=$1`,
      '23514',
      [id],
    );
    await rejectSql(
      `UPDATE exam_attempts SET status='submitted', ended_at=expires_at, finalized_at=expires_at, correct=59, wrong=0, unanswered=0, simulated_score=1000 WHERE id=$1`,
      '23514',
      [id],
    );
    await db.query(
      `UPDATE exam_attempts SET status='timed_out', ended_at=expires_at, finalized_at=expires_at + interval '1 day', correct=30, wrong=20, unanswered=10, simulated_score=550 WHERE id=$1`,
      [id],
    );
  });

  it('keeps at most one payload per attempt and cascades its deletion', async () => {
    const id = randomUUID();
    await insertAttempt(id, cycleId);
    await db.query(
      `INSERT INTO exam_attempt_payloads(attempt_id, question_snapshot) VALUES ($1, '[]'::jsonb)`,
      [id],
    );
    await rejectSql(
      `INSERT INTO exam_attempt_payloads(attempt_id, question_snapshot) VALUES ($1, '[]'::jsonb)`,
      '23505',
      [id],
    );
    await db.query(`DELETE FROM exam_attempts WHERE id=$1`, [id]);
    expect(
      (await db.query(`SELECT * FROM exam_attempt_payloads`)).rows,
    ).toHaveLength(0);
  });

  it('rolls back summary changes when finalization transaction fails', async () => {
    const id = randomUUID();
    await insertAttempt(id, cycleId);
    await db.query(
      `INSERT INTO exam_attempt_payloads(attempt_id, question_snapshot) VALUES ($1, '[]'::jsonb)`,
      [id],
    );
    await db.exec('SAVEPOINT finalize');
    await db.query(`DELETE FROM exam_attempt_payloads WHERE attempt_id=$1`, [
      id,
    ]);
    await expect(
      db.query(`UPDATE exam_attempts SET status='submitted' WHERE id=$1`, [id]),
    ).rejects.toMatchObject({ code: '23514' });
    await db.exec('ROLLBACK TO SAVEPOINT finalize');
    expect(
      (
        await db.query(
          `SELECT * FROM exam_attempt_payloads WHERE attempt_id=$1`,
          [id],
        )
      ).rows,
    ).toHaveLength(1);
  });

  it('protects rate counters and audit actor/target references', async () => {
    await rejectSql(
      `INSERT INTO rate_limits(key, window_started_at, count, expires_at) VALUES ('ip-hash', now(), -1, now() + interval '1 minute')`,
      '23514',
    );
    await rejectSql(
      `INSERT INTO admin_audit_logs(actor_user_id, target_user_id, action) VALUES ($1, $2, 'reset_password')`,
      '23503',
      [randomUUID(), alice],
    );
    await db.query(
      `INSERT INTO admin_audit_logs(actor_user_id, target_user_id, action) VALUES ($1, $2, 'reset_password')`,
      [bob, alice],
    );
    await rejectSql(`DELETE FROM users WHERE id=$1`, '23503', [bob]);
  });
  it('rejects orphan cycles, payloads and audit targets', async () => {
    await rejectSql(
      `INSERT INTO exam_cycles(user_id, topic_code, seed, bank_version, generator_version) VALUES ($1, 'cca-f', 's', 'b', 'v1')`,
      '23503',
      [randomUUID()],
    );
    await rejectSql(
      `INSERT INTO exam_attempt_payloads(attempt_id, question_snapshot) VALUES ($1, '[]'::jsonb)`,
      '23503',
      [randomUUID()],
    );
    await rejectSql(
      `INSERT INTO admin_audit_logs(actor_user_id, target_user_id, action) VALUES ($1, $2, 'create_user')`,
      '23503',
      [bob, randomUUID()],
    );
  });

  it('rejects invalid rate windows, audit actions and JSON shapes', async () => {
    await rejectSql(
      `INSERT INTO rate_limits(key, window_started_at, expires_at) VALUES ('expired-window', now(), now())`,
      '23514',
    );
    await rejectSql(
      `INSERT INTO admin_audit_logs(actor_user_id, target_user_id, action) VALUES ($1, $2, 'delete_everything')`,
      '23514',
      [bob, alice],
    );
    await rejectSql(
      `INSERT INTO admin_audit_logs(actor_user_id, target_user_id, action, metadata) VALUES ($1, $2, 'create_user', '[]'::jsonb)`,
      '23514',
      [bob, alice],
    );
    const id = randomUUID();
    await insertAttempt(id, cycleId);
    await rejectSql(
      `INSERT INTO exam_attempt_payloads(attempt_id, question_snapshot) VALUES ($1, '{}'::jsonb)`,
      '23514',
      [id],
    );
    await rejectSql(
      `INSERT INTO exam_attempt_payloads(attempt_id, question_snapshot, answers) VALUES ($1, '[]'::jsonb, '[]'::jsonb)`,
      '23514',
      [id],
    );
  });
});
