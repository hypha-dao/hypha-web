import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
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
      {/* each route mounts its own StoreProvider with its entry point — see app.tsx */}
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
