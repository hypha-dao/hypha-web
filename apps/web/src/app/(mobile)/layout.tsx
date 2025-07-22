import { NextSSRPlugin } from '@uploadthing/react/next-ssr-plugin';
import { extractRouterConfig } from 'uploadthing/server';
import { Lato, Source_Sans_3 } from 'next/font/google';
import clsx from 'clsx';

import { Html, ThemeProvider } from '@hypha-platform/ui/server';
import { AuthProvider } from '@hypha-platform/authentication';
import { EvmProvider } from '@hypha-platform/evm';
import { fileRouter } from '@hypha-platform/core/server';

import { MenuTop } from '@hypha-platform/ui';

import '@hypha-platform/ui-utils/global.css';

const lato = Lato({
  subsets: ['latin'],
  display: 'swap',
  weight: ['900', '700', '400', '300'],
  variable: '--font-heading',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  display: 'swap',
  weight: ['900', '700', '400', '300'],
  variable: '--font-body',
});

export const metadata = {
  title: 'Hypha - Sign in',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Html className={clsx(lato.variable, sourceSans.variable)}>
      <AuthProvider
        config={{
          appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
        }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <EvmProvider>
            <MenuTop logoHref={`/signin`} />
            <NextSSRPlugin routerConfig={extractRouterConfig(fileRouter)} />
            <div className="h-screen">{children}</div>
          </EvmProvider>
        </ThemeProvider>
      </AuthProvider>
    </Html>
  );
}
