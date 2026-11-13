import { redirect } from 'next/navigation';
import { getPageSession } from '@/modules/auth/server/page-session';
import { authDestination } from '@/modules/auth/contracts/navigation';
import { AuthForm } from '@/modules/auth/components/auth-form';
import { LogoutButton } from '@/modules/auth/components/logout-button';

export default async function SetupPasswordPage() {
  const session = await getPageSession();
  if (!session) redirect('/login');
  if (session.kind !== 'password_setup') redirect(authDestination(session));
  return (
    <>
      <p className="text-sm font-semibold text-primary">CCA</p>
      <h1 className="mt-3 text-2xl font-semibold">Set your password</h1>
      <p className="mb-7 mt-3 text-sm leading-relaxed text-muted-foreground">
        Welcome, {session.user.username}. Create a password between 12 and 128
        characters for future sign-ins.
      </p>
      <AuthForm mode="setup" />
      <div className="mt-6">
        <LogoutButton />
      </div>
    </>
  );
}
