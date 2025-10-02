import { VercelToolbar } from '@vercel/toolbar/next';
import { NextSSRPlugin } from '@uploadthing/react/next-ssr-plugin';
import { extractRouterConfig } from 'uploadthing/server';
import { cookies } from 'next/headers';
import { Lato, Source_Sans_3 } from 'next/font/google';
import clsx from 'clsx';
import type { Metadata } from 'next';

import { Footer, Html, ThemeProvider } from '@hypha-platform/ui/server';
import { AuthProvider } from '@hypha-platform/authentication';
import { useAuthentication } from '@hypha-platform/authentication';
import { ConnectedButtonProfile } from '@hypha-platform/epics';
import { EvmProvider } from '@hypha-platform/evm';
import { useMe } from '@hypha-platform/core/client';
import { fileRouter } from '@hypha-platform/core/server';
import { HYPHA_LOCALE } from '@hypha-platform/cookie';
import { i18nConfig } from '@hypha-platform/i18n';
import { MenuTop } from '@hypha-platform/ui';
import { ROOT_URL } from './constants';
import { NotificationSubscriber } from '@hypha-platform/notifications/client';

import '@hypha-platform/ui-utils/global.css';
import 'react-tooltip/dist/react-tooltip.css';
import ScrollUp from '@web/components/scroll-up';
import SeamlessScrollPolyfill from '@web/components/seamless-scroll-polyfill';
import '@web/utils/initialize-proxy';

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

export const metadata: Metadata = {
  title: 'Hypha',
  description:
    "Hypha's complete DAO toolkit helps individuals, projects, and organizations achieve more together",
  icons: {
    icon: [
      {
        url: '/icon/favicon.ico',
        type: 'image/x-icon',
      },
      {
        url: '/icon/favicon-16x16.png',
        type: 'image/png',
        sizes: '16x16',
      },
      {
        url: '/icon/favicon-32x32.png',
        type: 'image/png',
        sizes: '32x32',
      },
      {
        url: '/icon/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/icon/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    apple: {
      url: '/icon/apple-touch-icon.png',
      type: 'image/png',
    },
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shouldInjectToolbar = process.env.NODE_ENV === 'development';
  const cookieStore = await cookies();
  const lang = cookieStore.get(HYPHA_LOCALE)?.value || i18nConfig.defaultLocale;
  const notificationAppId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '';
  const safariWebId = process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID ?? '';
  const serviceWorkerPath = 'onesignal/OneSignalSDKWorker.js';

  return (
    <Html className={clsx(lato.variable, sourceSans.variable)}>
      <ScrollUp />
      <SeamlessScrollPolyfill />
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
            <NotificationSubscriber
              appId={notificationAppId}
              safariWebId={safariWebId}
              serviceWorkerPath={serviceWorkerPath}
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
              <NextSSRPlugin routerConfig={extractRouterConfig(fileRouter)} />
              <div className="mb-auto pb-8">
                <div className="pt-9 h-full flex justify-normal">
                  <div className="w-full h-full">{children}</div>
                </div>
              </div>
              <Footer />
            </NotificationSubscriber>
          </EvmProvider>
        </ThemeProvider>
      </AuthProvider>
      {shouldInjectToolbar && <VercelToolbar />}
    </Html>
  );
}
