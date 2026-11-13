'use client';
import { Button } from '@/components/ui/button';
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <section role="alert" className="rounded-xl border border-border p-8">
      <h1 className="text-xl font-semibold">Unable to load this page</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your data could not be loaded. Please try again.
      </p>
      <Button className="mt-5" onClick={reset}>
        Retry
      </Button>
    </section>
  );
}
