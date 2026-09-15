import type { Metadata, Viewport } from 'next';
import SWRegister from './sw-register';

export const metadata: Metadata = {
  title: 'AI Analytics Dashboard',
  description: 'Natural language to SQL analytics platform',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#533afd',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#533afd" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Analytics" />
      </head>
      <body style={{ margin: 0, background: '#0f172a' }}>
        {children}
        <SWRegister />
      </body>
    </html>
  );
}
