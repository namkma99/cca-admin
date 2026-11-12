import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'CCA Admin', template: '%s | CCA Admin' },
  description: 'Quản lý tài khoản và phòng thi CCA.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
