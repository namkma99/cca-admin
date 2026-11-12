import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold tracking-widest text-primary">CCA</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">
        Quản lý phòng thi
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
        Đăng nhập bằng tài khoản được cấp để tiếp tục.
      </p>
      <div className="mt-8">
        <Button asChild>
          <Link href="/login">Đăng nhập</Link>
        </Button>
      </div>
    </main>
  );
}
