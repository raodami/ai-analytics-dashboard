import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Analytics Dashboard',
  description: 'Natural language to SQL analytics platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0f172a' }}>{children}</body>
    </html>
  );
}
