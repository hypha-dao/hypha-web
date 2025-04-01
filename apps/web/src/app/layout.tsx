import { VercelToolbar } from '@vercel/toolbar/next';
import { NextSSRPlugin } from '@uploadthing/react/next-ssr-plugin';
import { extractRouterConfig } from 'uploadthing/server';

import { Lato, Source_Sans_3 } from 'next/font/google';
import clsx from 'clsx';

import { enableWeb3Auth } from '@hypha-platform/feature-flags';
import {
  Footer,
  Html,
  MenuTop,
  ThemeProvider,
} from '@hypha-platform/ui/server';
import { AuthProvider } from '@hypha-platform/authentication';
import { useAuthentication } from '@hypha-platform/authentication';
import { ConnectedButtonProfile } from '@hypha-platform/epics';
import { EvmProvider } from '@hypha-platform/evm';
import { useMe } from '@web/hooks/use-me';
import { fileRouter } from '@hypha-platform/core/server';

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
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isWeb3AuthEnabled = await enableWeb3Auth();
  const shouldInjectToolbar = process.env.NODE_ENV === 'development';
  return (
    <Html className={clsx(lato.variable, sourceSans.variable)}>
      <AuthProvider
        config={
          isWeb3AuthEnabled
            ? {
                type: 'web3auth' as const,
                clientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!,
              }
            : {
                type: 'privy' as const,
                appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
              }
        }
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <EvmProvider>
            <MenuTop
              withLogo={true}
              navItems={[
                {
                  label: 'Network',
                  href: `/network`,
                },
                {
                  label: 'My Spaces',
                  href: `/my-spaces`,
                },
                {
                  label: 'Wallet',
                  href: `/wallet`,
                },
              ]}
            >
              <MenuTop.RightSlot>
                <ConnectedButtonProfile
                  useAuthentication={useAuthentication}
                  useMe={useMe}
                  newUserRedirectPath="/profile/signup"
                />
              </MenuTop.RightSlot>
            </MenuTop>
            <NextSSRPlugin routerConfig={extractRouterConfig(fileRouter)} />
            <div className="mb-auto">{children}</div>
            <Footer />
          </EvmProvider>
        </ThemeProvider>
      </AuthProvider>
      {shouldInjectToolbar && <VercelToolbar />}
    </Html>
  );
}
