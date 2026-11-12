'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error('Logout failed');
      router.replace('/login');
      router.refresh();
    } catch {
      setError('Chưa thể đăng xuất. Vui lòng thử lại.');
      setPending(false);
    }
  }
  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={logout} disabled={pending}>
        {pending ? 'Đang đăng xuất…' : 'Đăng xuất'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
