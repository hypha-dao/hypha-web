import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { StoreProvider } from '@/lib/store';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
});

export const metadata: Metadata = {
  title: 'Hypha — Intelligent Org',
  description:
    'Clickable preview of Hypha redesigned around the intelligent-org loop',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="font-sans antialiased">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
