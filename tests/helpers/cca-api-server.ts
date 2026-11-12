import { createServer } from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readFile, readdir } from 'node:fs/promises';
import * as schema from '../../src/server/db/schema';
import { AuthService } from '../../src/modules/auth/server/service';
import { ExamService } from '../../src/modules/exams/server/service';
import { UserService } from '../../src/modules/users/server/service';
import { createAuthHandlers } from '../../src/modules/auth/server/http';
import { createProtectedHandler } from '../../src/server/http/protected';
import { readAuthConfig } from '../../src/server/security/auth-config';
import { hashPassword } from '../../src/server/security/password';
import { importQuestions } from '../../src/modules/question-bank/server/import-questions';
import { syntheticBank } from './synthetic-bank';

const client = new PGlite();
const db = drizzle(client, { schema });
for (const file of (await readdir('drizzle'))
  .filter((name) => name.endsWith('.sql'))
  .sort())
  await client.exec(await readFile(`drizzle/${file}`, 'utf8'));
let offset = 0;
const clock = () => new Date(Date.now() + offset);
const passwordHash = await hashPassword('fixture-password-123');
async function reset() {
  offset = 0;
  await client.exec('TRUNCATE users,questions,rate_limits CASCADE');
  await importQuestions(db, syntheticBank());
  await db.insert(schema.users).values([
    {
      username: 'admin',
      passwordHash,
      role: 'admin',
      status: 'active',
      firstLoginAt: clock(),
    },
    { username: 'student', passwordHash, status: 'pending_password' },
  ]);
}
await reset();
const config = readAuthConfig({
  NODE_ENV: 'test',
  APP_ORIGIN: 'http://127.0.0.1:4321',
  CCA_ALLOWED_ORIGINS: 'http://127.0.0.1:4175',
});
const auth = createAuthHandlers({
  config,
  runWithService: async (work) => work(new AuthService(db, { now: clock })),
});
const protectedRoute = createProtectedHandler({
  config,
  runWithDatabase: async (work) => work(db),
});
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1:4321');
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    if (url.pathname.startsWith('/__test/')) {
      if (req.headers['x-fixture-key'] !== 'local-test-only') {
        res.writeHead(403).end();
        return;
      }
      if (url.pathname === '/__test/reset') await reset();
      if (url.pathname === '/__test/advance')
        offset += Number(
          JSON.parse(Buffer.concat(chunks).toString()).milliseconds,
        );
      res
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end('{"ok":true}');
      return;
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers))
      if (value)
        headers.set(key, Array.isArray(value) ? value.join(',') : value);
    const request = new Request(url, {
      method: req.method,
      headers,
      ...(chunks.length
        ? { body: Buffer.concat(chunks).toString('utf8') }
        : {}),
    });
    let response: Response;
    const authOp = url.pathname.split('/').pop();
    if (url.pathname.startsWith('/api/v1/auth/') && authOp) {
      const operation =
        req.method === 'OPTIONS'
          ? 'options'
          : authOp === 'setup-password'
            ? 'setupPassword'
            : authOp;
      response = await auth[operation as keyof typeof auth](request);
    } else {
      response = await protectedRoute(
        request,
        async (_db, token, input) => {
          const exams = new ExamService(db, { now: clock });
          if (url.pathname.endsWith('/catalog')) return exams.catalog(token);
          if (url.pathname.endsWith('/dashboard'))
            return exams.dashboard(token);
          if (url.pathname === '/api/v1/exams/attempts')
            return exams.start(
              token,
              input as Parameters<ExamService['start']>[1],
            );
          const match = url.pathname.match(
            /\/exams\/attempts\/([^/]+)(?:\/(answers|submit|abandon))?$/,
          );
          if (match) {
            const id = match[1]!;
            if (match[2] === 'answers')
              return exams.save(
                token,
                id,
                input as Parameters<ExamService['save']>[2],
              );
            if (match[2] === 'submit' || match[2] === 'abandon')
              return exams.finish(token, id, match[2]);
            return exams.status(token, id);
          }
          const userService = new UserService(db, { now: clock });
          if (url.pathname === '/api/v1/admin/users')
            return req.method === 'POST'
              ? userService.create(token, input as { username: string })
              : userService.list(token);
          const resetMatch = url.pathname.match(
            /\/admin\/users\/([^/]+)\/reset-cycle$/,
          );
          if (resetMatch) {
            await exams.resetTopic(
              token,
              resetMatch[1]!,
              (input as { topicId: 'cca-f' }).topicId,
            );
            return { ok: true };
          }
          throw new Error('Unknown fixture route');
        },
        url.pathname.includes('/admin/'),
      );
    }
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res
      .writeHead(500, { 'Content-Type': 'application/json' })
      .end('{"error":{"message":"Fixture failure"}}');
  }
});
server.listen(4321, '127.0.0.1', () => console.log('CCA fixture API ready'));
const close = () => {
  server.close(() => {
    void client.close().then(() => process.exit(0));
  });
};
process.on('SIGTERM', close);
process.on('SIGINT', close);
