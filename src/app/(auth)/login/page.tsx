import { redirect } from 'next/navigation';
import { getPageSession } from '@/modules/auth/server/page-session';
import { authDestination } from '@/modules/auth/contracts/navigation';
import { AuthForm } from '@/modules/auth/components/auth-form';

export default async function LoginPage() {
  const session = await getPageSession();
  if (session) redirect(authDestination(session));
  return (
    <>
      <p className="text-sm font-semibold text-primary">CCA</p>
      <h1 className="mt-3 text-2xl font-semibold">Sign in</h1>
      <p className="mb-7 mt-3 text-sm leading-relaxed text-muted-foreground">
        Use the account provided by your administrator to continue.
      </p>
      <AuthForm mode="login" />
    </>
  );
}
