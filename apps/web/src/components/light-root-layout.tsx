'use client';

import React from 'react';
import { Footer, MenuTop } from '@hypha-platform/ui';
import {
  AuthProvider,
  useAuthentication,
} from '@hypha-platform/authentication';
import { ThemeProvider } from '@hypha-platform/ui/server';
import { ConnectedButtonProfile } from '@hypha-platform/epics';
import { VercelToolbar } from '@vercel/toolbar/next';
import { useParams } from 'next/navigation';
import { i18nConfig } from '@hypha-platform/i18n';
import { useMe } from '@hypha-platform/core/client';
import clsx from 'clsx';
import { Lato, Source_Sans_3 } from 'next/font/google';
import { ROOT_URL } from '@web/app/constants';

import '@hypha-platform/ui-utils/global.css';
import 'react-tooltip/dist/react-tooltip.css';

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

export function LightRootLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const lang = params?.lang ?? i18nConfig.defaultLocale;
  const shouldInjectToolbar = process.env.NODE_ENV === 'development';

  return (
    <div className={clsx(lato.variable, sourceSans.variable)}>
      <div className="flex flex-col w-full h-screen justify-between">
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
            <MenuTop logoHref={ROOT_URL}>
              <ConnectedButtonProfile
                useAuthentication={useAuthentication}
                useMe={useMe}
                newUserRedirectPath="/profile/signup"
                baseRedirectPath="/my-spaces"
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
              />
            </MenuTop>
            <div className="mb-auto pb-8">
              <div className="pt-9 h-full flex justify-normal">
                <div className="w-full h-full">{children}</div>
              </div>
            </div>
            <Footer />
          </ThemeProvider>
        </AuthProvider>
        {shouldInjectToolbar && <VercelToolbar />}
      </div>
    </div>
  );
}
