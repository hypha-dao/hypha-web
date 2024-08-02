import { Theme } from '@hypha-platform/ui/server';
import '@radix-ui/themes/styles.css';

import './global.css';

export const metadata = {
  title: 'Welcome to web',
  description: 'Generated by create-nx-workspace',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-50">
      <body className="flex h-full">
        <Theme>{children}</Theme>
      </body>
    </html>
  );
}
