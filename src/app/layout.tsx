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
  themeColor: '#090d16',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col selection:bg-red-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
