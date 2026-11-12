import { protectedApi } from '@/server/http/protected';
import { SettingsService } from '@/modules/settings/server/service';
import { AuthService } from '@/modules/auth/server/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = (request: Request) =>
  protectedApi(
    request,
    async (db) => ({ settings: await new SettingsService(db).getAll() }),
    true,
  );

export const PUT = (request: Request) =>
  protectedApi(
    request,
    async (db, token, input) => {
      const session = await new AuthService(db).requireSession(token, 'admin');
      const updated = await new SettingsService(db).update(
        session.user.id,
        input,
      );
      return { settings: updated };
    },
    true,
  );

export const OPTIONS = (request: Request) =>
  protectedApi(request, async () => ({}), true);
