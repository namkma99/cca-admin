import { requirePageSession } from '@/modules/auth/server/page-session';
import { withDatabase } from '@/server/db/client';
import { SettingsService } from '@/modules/settings/server/service';
import { SettingsPanel } from '@/modules/settings/components/settings-panel';

export default async function AdminSettingsPage() {
  await requirePageSession('admin');
  const initialSettings = await withDatabase((db) =>
    new SettingsService(db).getAll(),
  );

  return <SettingsPanel initialSettings={initialSettings} />;
}
