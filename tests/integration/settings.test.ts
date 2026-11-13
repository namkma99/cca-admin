import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase } from '../helpers/database';
import { SettingsService } from '../../src/modules/settings/server/service';
import { AuthService } from '../../src/modules/auth/server/service';
import { hashPassword } from '../../src/server/security/password';
import { users } from '../../src/server/db/schema';
import { createProtectedHandler } from '../../src/server/http/protected';
import { readAuthConfig } from '../../src/server/security/auth-config';

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let service: SettingsService;
let adminId: string;
let adminCookie: string;
let studentCookie: string;
const origin = 'https://cca.dev-pro.online';
const password = 'admin-password-123';

beforeAll(async () => {
  fixture = await createTestDatabase();
}, 30000);

afterAll(async () => {
  await fixture?.client.close();
});

beforeEach(async () => {
  await fixture.client.exec('TRUNCATE users, settings, rate_limits CASCADE');
  const hash = await hashPassword(password);
  const [admin] = await fixture.db
    .insert(users)
    .values({
      username: 'admin',
      passwordHash: hash,
      role: 'admin',
      status: 'active',
    })
    .returning();
  await fixture.db.insert(users).values({
    username: 'student',
    passwordHash: hash,
    role: 'student',
    status: 'active',
  });

  adminId = admin!.id;
  const auth = new AuthService(fixture.db);
  const aLogin = await auth.login({ username: 'admin', password }, 'test');
  const sLogin = await auth.login({ username: 'student', password }, 'test');

  adminCookie = `cca_session=${'token' in aLogin ? aLogin.token : ''}`;
  studentCookie = `cca_session=${'token' in sLogin ? sLogin.token : ''}`;
  service = new SettingsService(fixture.db);
});

describe('SettingsService', () => {
  it('returns default settings when database has no records', async () => {
    const result = await service.getAll();
    expect(result).toEqual({
      examDurationMinutes: 120,
      formCount: 10,
      passingScorePercentage: 70,
      systemName: 'CCA Exam System',
      allowReviewAnswers: true,
      auth: {
        sessionDurationMinutes: 1440,
        passwordSetupDurationMinutes: 10,
        loginRateLimit: {
          windowMinutes: 15,
          maxAttemptsPerUsername: 10,
          maxAttemptsPerIp: 50,
        },
      },
    });
  });

  it('updates settings and persists them to the database', async () => {
    const updated = await service.update(adminId, {
      examDurationMinutes: 90,
      formCount: 15,
      passingScorePercentage: 75,
      systemName: 'Custom CCA Portal',
      allowReviewAnswers: false,
    });

    expect(updated).toEqual({
      examDurationMinutes: 90,
      formCount: 15,
      passingScorePercentage: 75,
      systemName: 'Custom CCA Portal',
      allowReviewAnswers: false,
      auth: {
        sessionDurationMinutes: 1440,
        passwordSetupDurationMinutes: 10,
        loginRateLimit: {
          windowMinutes: 15,
          maxAttemptsPerUsername: 10,
          maxAttemptsPerIp: 50,
        },
      },
    });

    const read = await service.getAll();
    expect(read).toEqual(updated);
  });

  it('supports partial updates without wiping other settings', async () => {
    await service.update(adminId, { examDurationMinutes: 60 });
    const result = await service.update(adminId, { formCount: 5 });

    expect(result.examDurationMinutes).toBe(60);
    expect(result.formCount).toBe(5);
    expect(result.passingScorePercentage).toBe(70);
  });
});

describe('Settings API HTTP boundary', () => {
  it('allows admin to fetch and update settings, and rejects unauthorized users', async () => {
    const handler = createProtectedHandler({
      config: readAuthConfig({ NODE_ENV: 'test', APP_ORIGIN: origin }),
      runWithDatabase: async (work) => work(fixture.db),
    });

    const getReq = (cookie?: string) =>
      new Request(`${origin}/api/v1/admin/settings`, {
        headers: cookie ? { Cookie: cookie } : {},
      });

    // Unauthenticated
    const resNoAuth = await handler(
      getReq(),
      async (db) => ({ settings: await new SettingsService(db).getAll() }),
      true,
    );
    expect(resNoAuth.status).toBe(401);

    // Student forbidden
    const resStudent = await handler(
      getReq(studentCookie),
      async (db) => ({ settings: await new SettingsService(db).getAll() }),
      true,
    );
    expect(resStudent.status).toBe(403);

    // Admin allowed
    const resAdmin = await handler(
      getReq(adminCookie),
      async (db) => ({ settings: await new SettingsService(db).getAll() }),
      true,
    );
    expect(resAdmin.status).toBe(200);
    const body = await resAdmin.json();
    expect(body.settings.examDurationMinutes).toBe(120);
  });
});
