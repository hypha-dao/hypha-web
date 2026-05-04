import { VercelToolbar } from '@vercel/toolbar/next';
import { NextSSRPlugin } from '@uploadthing/react/next-ssr-plugin';
import { extractRouterConfig } from 'uploadthing/server';
import { Lato, Source_Sans_3 } from 'next/font/google';
import clsx from 'clsx';
import type { Metadata } from 'next';

import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';

import { Footer, Html, ThemeProvider } from '@hypha-platform/ui/server';
import { AuthProvider } from '@hypha-platform/authentication';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  AiLeftPanel,
  PanelProviders,
  PanelWrapLayout,
  AiSidebarTrigger,
  HumanSidebarTrigger,
  ConnectedButtonProfile,
} from '@hypha-platform/epics';
import { ConnectedHumanRightPanel } from '@web/components/connected-human-right-panel';
import { EvmProvider } from '@hypha-platform/evm';
import { useMe } from '@hypha-platform/core/client';
import { ConditionalMatrixProvider } from '@web/components/conditional-matrix-provider';
import { fileRouter } from '@hypha-platform/core/server';
import { TooltipProvider } from '@hypha-platform/ui';
import { ROOT_URL } from './constants';
import {
  getEnableAiChat,
  getEnableHumanChat,
} from '@hypha-platform/feature-flags';
import { NotificationSubscriber } from '@hypha-platform/notifications/client';

import '@hypha-platform/ui-utils/global.css';
import 'react-tooltip/dist/react-tooltip.css';
import { ConnectedLanguageSelect } from '@web/components/connected-language-select';
import { getShowLanguageSelect } from '@hypha-platform/feature-flags';
import ScrollUp from '@web/components/scroll-up';
import SeamlessScrollPolyfill from '@web/components/seamless-scroll-polyfill';
import { ThemeStorageNormalize } from '@web/components/theme-storage-normalize';
import { ConnectedMenuTop } from '@web/components/connected-menu-top';
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
  const isLanguageSelectVisible = await getShowLanguageSelect();
  const locale = await getLocale();
  const messages = await getMessages();
  const tNav = await getTranslations('Navigation');
  const tFooter = await getTranslations('Footer');
  const notificationAppId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '';
  const safariWebId = process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID ?? '';
  const serviceWorkerPath = 'onesignal/OneSignalSDKWorker.js';
  const aiChatEnabled = await getEnableAiChat();
  const humanChatEnabled = await getEnableHumanChat();

  return (
    <Html lang={locale} className={clsx(lato.variable, sourceSans.variable)}>
      <ScrollUp />
      <SeamlessScrollPolyfill />
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
            <NextIntlClientProvider locale={locale} messages={messages}>
              <TooltipProvider>
                <NotificationSubscriber
                  appId={notificationAppId}
                  safariWebId={safariWebId}
                  serviceWorkerPath={serviceWorkerPath}
                >
                  <ConditionalMatrixProvider enabled={humanChatEnabled}>
                    <PanelProviders>
                      <PanelWrapLayout
                        left={
                          aiChatEnabled
                            ? { content: <AiLeftPanel /> }
                            : undefined
                        }
                        right={
                          humanChatEnabled
                            ? { content: <ConnectedHumanRightPanel /> }
                            : undefined
                        }
                      >
                        {/* Fixed menu bar — clamped to center column by SidebarInset */}
                        <div className="sticky top-0 z-30 shrink-0">
                          <ConnectedMenuTop
                            aiChatEnabled={aiChatEnabled}
                            logoHref={ROOT_URL}
                            openMenuLabel={tNav('openMenu')}
                            closeMenuLabel={tNav('closeMenu')}
                            leadingAction={
                              aiChatEnabled ? <AiSidebarTrigger /> : undefined
                            }
                            trailingAction={
                              humanChatEnabled ? (
                                <HumanSidebarTrigger />
                              ) : undefined
                            }
                          >
                            <ConnectedButtonProfile
                              useAuthentication={useAuthentication}
                              useMe={useMe}
                              newUserRedirectPath="/profile/signup"
                              baseRedirectPath="/my-spaces"
                              navItems={[
                                {
                                  label: tNav('mySpaces'),
                                  href: `/${locale}/my-spaces`,
                                },
                                {
                                  label: tNav('network'),
                                  href: `/${locale}/network`,
                                },
                              ]}
                              trailingBeforeProfile={
                                isLanguageSelectVisible ? (
                                  <ConnectedLanguageSelect />
                                ) : undefined
                              }
                            />
                          </ConnectedMenuTop>
                        </div>
                        {/* Scrollable content area */}
                        <NextSSRPlugin
                          routerConfig={extractRouterConfig(fileRouter)}
                        />
                        <div className="mb-auto pb-8">
                          <div className="flex h-full justify-normal pt-4 md:pt-5">
                            <div className="w-full h-full">{children}</div>
                          </div>
                        </div>
                        <Footer
                          networkLabel={tFooter('network')}
                          legalLabel={tFooter('legal')}
                          hyphaServicesLabel={tFooter('hyphaServices')}
                          hyphaTokenomicsLabel={tFooter('hyphaTokenomics')}
                          licensingPolicyLabel={tFooter('licensingPolicy')}
                          termsAndConditionsLabel={tFooter(
                            'termsAndConditions',
                          )}
                          privacyPolicyLabel={tFooter('privacyPolicy')}
                        />
                      </PanelWrapLayout>
                    </PanelProviders>
                  </ConditionalMatrixProvider>
                </NotificationSubscriber>
              </TooltipProvider>
            </NextIntlClientProvider>
          </EvmProvider>
        </ThemeProvider>
      </AuthProvider>
      {shouldInjectToolbar && <VercelToolbar />}
    </Html>
  );
}
