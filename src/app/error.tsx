'use client';

import { Button } from '@/components/ui/button';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-start justify-center gap-5 px-6">
      <h1 className="text-2xl font-semibold">Không thể tải trang</h1>
      <p className="text-muted-foreground">Vui lòng thử lại sau ít phút.</p>
      <Button onClick={reset}>Thử lại</Button>
    </main>
  );
}
