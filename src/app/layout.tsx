import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NEPAL RESCUE | Emergency SAR Coordination',
  description:
    'Mobile-first emergency search and rescue coordination platform for crisis response in Nepal.',
  manifest: '/manifest.json',
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex flex-col antialiased selection:bg-red-700 selection:text-white">
        {children}
      </body>
    </html>
  );
}
