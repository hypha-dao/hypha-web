import { NextSSRPlugin } from '@uploadthing/react/next-ssr-plugin';
import { extractRouterConfig } from 'uploadthing/server';
import { Fraunces, IBM_Plex_Sans } from 'next/font/google';
import clsx from 'clsx';

import { Html, ThemeProvider } from '@hypha-platform/ui/server';
import { AuthProvider } from '@hypha-platform/authentication';
import { EvmProvider } from '@hypha-platform/evm';
import { fileRouter } from '@hypha-platform/core/server';

import { MenuTop } from '@hypha-platform/ui';

import '@hypha-platform/ui-utils/global.css';
import { ThemeStorageNormalize } from '@web/components/theme-storage-normalize';

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-heading',
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
});

export const metadata = {
  title: 'Hypha - Sign in',
};

// This route reads request headers (user-agent) and mounts its own
// AuthProvider, so it must never be statically prerendered.
export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Html className={clsx(fraunces.variable, ibmPlexSans.variable)}>
      <AuthProvider
        config={{
          appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
        }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          storageKey="theme"
          disableTransitionOnChange
        >
          <ThemeStorageNormalize />
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
