import { VercelToolbar } from '@vercel/toolbar/next';
import { NextSSRPlugin } from '@uploadthing/react/next-ssr-plugin';
import { extractRouterConfig } from 'uploadthing/server';
import { cookies } from 'next/headers';
import { Lato, Source_Sans_3 } from 'next/font/google';
import clsx from 'clsx';

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
import { useMe } from '@hypha-platform/core/client';
import { fileRouter } from '@hypha-platform/core/server';
import { HYPHA_LOCALE } from '@hypha-platform/cookie';
import { i18nConfig } from '@hypha-platform/i18n';

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
  const shouldInjectToolbar = process.env.NODE_ENV === 'development';
  const cookieStore = await cookies();
  const lang = cookieStore.get(HYPHA_LOCALE)?.value || i18nConfig.defaultLocale;

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
            <MenuTop
              logoHref={`/${lang}/network`}
              navItems={[
                {
                  label: 'Network',
                  href: `/${lang}/network`,
                },
                {
                  label: 'My Spaces',
                  href: `/${lang}/my-spaces`,
                },
              ]}
            >
              <MenuTop.RightSlot>
                <ConnectedButtonProfile
                  useAuthentication={useAuthentication}
                  useMe={useMe}
                  newUserRedirectPath="/profile/signup"
                  baseRedirectPath="/network"
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
