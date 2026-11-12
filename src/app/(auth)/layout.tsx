import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
        {children}
      </section>
    </main>
  );
}
