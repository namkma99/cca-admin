import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold tracking-widest text-primary">CCA</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">
        CCA exam management
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
        Sign in with your assigned account to continue.
      </p>
      <div className="mt-8">
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}
