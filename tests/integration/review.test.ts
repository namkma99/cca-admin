import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDatabase } from '../helpers/database';
import {
  authSessions,
  examAttempts,
  examCycles,
  questions,
  users,
} from '../../src/server/db/schema';
import {
  createSessionToken,
  hashSessionToken,
} from '../../src/server/security/session-token';
import {
  GET as getTopics,
  OPTIONS as topicsOptions,
} from '../../src/app/api/v1/review/topics/route';
import {
  GET as getQuestions,
  OPTIONS as questionsOptions,
} from '../../src/app/api/v1/review/topics/[topicId]/questions/route';

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let studentToken: string;
let studentId: string;
let adminToken: string;
let setupToken: string;
const origin = 'https://cca.example.com';
const frontend = 'https://learn.example.com';

// Replace only the external Neon connection; routes, SQL and auth run unchanged.
vi.mock('../../src/server/db/client', () => ({
  withDatabase: async (work: (db: typeof fixture.db) => Promise<unknown>) =>
    work(fixture.db),
}));

function request(path: string, token?: string, requestOrigin = frontend) {
  return new Request(`${origin}/api/v1/review/topics${path}`, {
    headers: {
      Origin: requestOrigin,
      ...(token ? { Cookie: `__Host-cca_session=${token}` } : {}),
    },
  });
}

function topicQuestions(topicId: string, token?: string) {
  return getQuestions(request(`/${topicId}/questions`, token), {
    params: Promise.resolve({ topicId }),
  });
}

async function session(
  username: string,
  role: 'student' | 'admin' = 'student',
  setup = false,
) {
  const [user] = await fixture.db
    .insert(users)
    .values({
      username,
      role,
      status: setup ? 'pending_password' : 'active',
    })
    .returning();
  const token = createSessionToken();
  await fixture.db.insert(authSessions).values({
    userId: user!.id,
    tokenHash: hashSessionToken(token),
    kind: setup ? 'password_setup' : 'authenticated',
    createdAt: new Date(Date.now() - 60_000),
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  return { token, id: user!.id };
}

beforeAll(async () => {
  fixture = await createTestDatabase();
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('APP_ORIGIN', origin);
  vi.stubEnv('CCA_ALLOWED_ORIGINS', frontend);
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await fixture?.client.close();
});
beforeEach(async () => {
  await fixture.client.exec('TRUNCATE users, questions CASCADE');
  const student = await session('reader');
  studentToken = student.token;
  studentId = student.id;
  adminToken = (await session('admin', 'admin')).token;
  setupToken = (await session('pending', 'student', true)).token;
  // More than the 60-question exam limit, deliberately inserted in reverse order.
  await fixture.db.insert(questions).values([
    ...Array.from({ length: 65 }, (_, i) => ({
      id: `cca-f-${65 - i}`,
      topicCode: 'cca-f' as const,
      sourceNumber: 65 - i,
      questionType: 'single_choice' as const,
      status: 'ready' as const,
      prompt: `Question ${65 - i}`,
      choices: [
        { id: 'A', text: 'Option A' },
        { id: 'B', text: 'Option B' },
      ],
      correctChoiceIds: ['B'],
    })),
    {
      id: 'ccao-f-multi',
      topicCode: 'ccao-f',
      sourceNumber: 1,
      questionType: 'multiple_response',
      status: 'ready',
      prompt: 'Select both',
      choices: [
        { id: 'A', text: 'First' },
        { id: 'B', text: 'Second' },
      ],
      correctChoiceIds: ['A', 'B'],
    },
    {
      id: 'draft',
      topicCode: 'cca-f',
      sourceNumber: 66,
      questionType: 'unsupported',
      status: 'needs_review',
    },
    {
      id: 'disabled',
      topicCode: 'cca-f',
      sourceNumber: 67,
      questionType: 'single_choice',
      status: 'disabled',
    },
  ]);
});

describe('review API', () => {
  it('counts existing ready questions and includes valid empty topics for students and admins', async () => {
    for (const token of [studentToken, adminToken]) {
      const response = await getTopics(request('', token));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        topics: [
          { id: 'cca-f', name: 'CCA-F', questionCount: 65 },
          { id: 'ccao-f', name: 'CCAO-F', questionCount: 1 },
          { id: 'ccar-p', name: 'CCAR-P', questionCount: 0 },
        ],
      });
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(response.headers.get('access-control-allow-origin')).toBe(
        frontend,
      );
      expect(response.headers.get('access-control-allow-credentials')).toBe(
        'true',
      );
    }
  });

  it('returns every ready question with answers in source order without consuming attempts', async () => {
    const response = await topicQuestions('cca-f', studentToken);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const body = await response.json();
    expect(body.topicId).toBe('cca-f');
    expect(body.total).toBe(65);
    expect(body.questions).toHaveLength(65);
    expect(body.questions[0]).toEqual({
      id: 'cca-f-1',
      type: 'single_choice',
      prompt: 'Question 1',
      choices: [
        { id: 'A', text: 'Option A' },
        { id: 'B', text: 'Option B' },
      ],
      correctChoiceIds: ['B'],
    });
    expect(body.questions[64].id).toBe('cca-f-65');
    expect(
      body.questions.some((q: { id: string }) =>
        ['draft', 'disabled', 'ccao-f-multi'].includes(q.id),
      ),
    ).toBe(false);
    expect(await fixture.db.select().from(examAttempts)).toEqual([]);
    expect(await fixture.db.select().from(examCycles)).toEqual([]);
  });

  it('preserves multiple correct answers for admin readers', async () => {
    const response = await topicQuestions('ccao-f', adminToken);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      topicId: 'ccao-f',
      total: 1,
      questions: [
        {
          id: 'ccao-f-multi',
          type: 'multiple_response',
          prompt: 'Select both',
          choices: [
            { id: 'A', text: 'First' },
            { id: 'B', text: 'Second' },
          ],
          correctChoiceIds: ['A', 'B'],
        },
      ],
    });
  });

  it('returns an empty list for a valid empty topic and 404 for unknown topics', async () => {
    const empty = await topicQuestions('ccar-p', studentToken);
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({
      topicId: 'ccar-p',
      total: 0,
      questions: [],
    });
    const unknown = await topicQuestions('react-19', studentToken);
    expect(unknown.status).toBe(404);
    expect((await unknown.json()).error.code).toBe('TOPIC_NOT_FOUND');
    expect(unknown.headers.get('cache-control')).toBe('private, no-store');
  });

  it.each([
    'missing',
    'malformed',
    'unknown',
    'expired',
    'revoked',
    'setup',
    'disabled',
  ])(
    'protects both endpoints from %s sessions and never returns answers',
    async (state) => {
      let token: string | undefined = studentToken;
      if (state === 'missing') token = undefined;
      if (state === 'malformed') token = 'invalid';
      if (state === 'unknown') token = createSessionToken();
      if (state === 'setup') token = setupToken;
      if (state === 'expired')
        await fixture.db
          .update(authSessions)
          .set({ expiresAt: new Date(Date.now() - 1_000) })
          .where(eq(authSessions.userId, studentId));
      if (state === 'revoked')
        await fixture.db
          .update(authSessions)
          .set({ revokedAt: new Date() })
          .where(eq(authSessions.userId, studentId));
      if (state === 'disabled')
        await fixture.db
          .update(users)
          .set({ status: 'disabled' })
          .where(eq(users.id, studentId));
      for (const response of [
        await getTopics(request('?isAuthenticated=true', token)),
        await topicQuestions('cca-f', token),
      ]) {
        expect(response.status).toBe(
          ['setup', 'disabled'].includes(state) ? 403 : 401,
        );
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        const body = await response.json();
        expect(body.error.code).toBe(
          ['setup', 'disabled'].includes(state)
            ? 'FORBIDDEN'
            : 'UNAUTHENTICATED',
        );
        expect(body).not.toHaveProperty('questions');
        expect(body).not.toHaveProperty('topics');
        expect(JSON.stringify(body)).not.toMatch(
          /correctChoiceIds|Option A|Question 1/,
        );
      }
    },
  );

  it('checks auth before revealing whether a topic exists', async () => {
    expect((await topicQuestions('unknown')).status).toBe(401);
  });

  it('rejects untrusted origins and supports credentialed preflight without exposing data', async () => {
    const denied = await getTopics(
      request('', studentToken, 'https://evil.example.com'),
    );
    expect(denied.status).toBe(403);
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
    expect(denied.headers.get('cache-control')).toBe('private, no-store');
    for (const options of [topicsOptions, questionsOptions]) {
      const response = await options(
        new Request(`${origin}/api/v1/review/topics`, {
          method: 'OPTIONS',
          headers: { Origin: frontend, 'Access-Control-Request-Method': 'GET' },
        }),
      );
      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe(
        frontend,
      );
      expect(response.headers.get('access-control-allow-credentials')).toBe(
        'true',
      );
      expect(await response.text()).toBe('');
    }
  });

  it('sanitizes configuration failures and prevents caching error responses', async () => {
    vi.stubEnv('APP_ORIGIN', 'invalid-origin');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      for (const response of [
        await getTopics(request('', studentToken)),
        await topicQuestions('cca-f', studentToken),
      ]) {
        expect(response.status).toBe(500);
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        const body = await response.json();
        expect(body.error.code).toBe('INTERNAL_ERROR');
        expect(body).not.toHaveProperty('questions');
      }
    } finally {
      vi.stubEnv('APP_ORIGIN', origin);
      log.mockRestore();
    }
  });
});
