import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-start justify-center gap-5 px-6">
      <h1 className="text-2xl font-semibold">Không tìm thấy trang</h1>
      <Button asChild>
        <Link href="/">Về trang chủ</Link>
      </Button>
    </main>
  );
}
