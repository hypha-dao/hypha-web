import { VercelToolbar } from '@vercel/toolbar/next';
import { NextSSRPlugin } from '@uploadthing/react/next-ssr-plugin';
import { extractRouterConfig } from 'uploadthing/server';
import { Lato, Source_Sans_3 } from 'next/font/google';
import clsx from 'clsx';
import type { Metadata } from 'next';

import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { defaultMessages } from '@hypha-platform/i18n/messages';

import { Footer, Html, ThemeProvider } from '@hypha-platform/ui/server';
import { AuthProvider } from '@hypha-platform/authentication';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  AiLeftPanel,
  AiSidebarTrigger,
  GlobalCallDockProvider,
  PanelProviders,
  PanelWrapLayout,
  HumanSidebarTrigger,
  ConnectedButtonProfile,
} from '@hypha-platform/epics';
import { ConnectedHumanRightPanel } from '@web/components/connected-human-right-panel';
import { ConnectedGlobalCallDock } from '@web/components/connected-global-call-dock';
import { useMe } from '@hypha-platform/core/client';
import { ConditionalMatrixProvider } from '@web/components/conditional-matrix-provider';
import { fileRouter } from '@hypha-platform/core/server';
import { TooltipProvider } from '@hypha-platform/ui';
import { ROOT_URL } from './constants';
import {
  getEnableAiChat,
  getEnableSpaceMemory,
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
import { AppNavigationSessionCounter } from '@web/components/app-navigation-session-counter';
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
  const notificationAppId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '';
  const safariWebId = process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID ?? '';
  const serviceWorkerPath = 'onesignal/OneSignalSDKWorker.js';
  let isLanguageSelectVisible = false;
  let locale = 'en';
  let messages: Record<string, unknown> = defaultMessages;
  let aiChatEnabled = false;
  let spaceMemoryEnabled = false;
  let humanChatEnabled = false;

  let navMySpacesLabel = 'My Spaces';
  let navNetworkLabel = 'Network';
  let navOpenMenuLabel = 'Open menu';
  let navCloseMenuLabel = 'Close menu';
  let navSelectLanguageLabel = 'Select language';
  let footerNetworkLabel = 'Network';
  let footerLegalLabel = 'Legal';
  let footerHyphaServicesLabel = 'Hypha Services';
  let footerHyphaTokenomicsLabel = 'Hypha Tokenomics';
  let footerLicensingPolicyLabel = 'Licensing Policy';
  let footerTermsAndConditionsLabel = 'Terms and Conditions';
  let footerPrivacyPolicyLabel = 'Privacy Policy';

  const [
    languageSelectResult,
    localeResult,
    messagesResult,
    navTranslationsResult,
    footerTranslationsResult,
    aiChatEnabledResult,
    spaceMemoryEnabledResult,
    humanChatEnabledResult,
  ] = await Promise.allSettled([
    getShowLanguageSelect(),
    getLocale(),
    getMessages(),
    getTranslations('Navigation'),
    getTranslations('Footer'),
    getEnableAiChat(),
    getEnableSpaceMemory(),
    getEnableHumanChat(),
  ]);

  if (languageSelectResult.status === 'fulfilled') {
    isLanguageSelectVisible = languageSelectResult.value;
  } else {
    console.error(
      '[app/layout] Failed to resolve showLanguageSelect',
      languageSelectResult.reason,
    );
  }

  if (localeResult.status === 'fulfilled') {
    locale = localeResult.value;
  } else {
    console.error('[app/layout] Failed to resolve locale', localeResult.reason);
  }

  if (messagesResult.status === 'fulfilled') {
    messages = messagesResult.value;
  } else {
    console.error(
      '[app/layout] Failed to resolve messages',
      messagesResult.reason,
    );
  }

  if (navTranslationsResult.status === 'fulfilled') {
    const tNav = navTranslationsResult.value;
    navMySpacesLabel = tNav('mySpaces');
    navNetworkLabel = tNav('network');
    navOpenMenuLabel = tNav('openMenu');
    navCloseMenuLabel = tNav('closeMenu');
    navSelectLanguageLabel = tNav('selectLanguage');
  } else {
    console.error(
      '[app/layout] Failed to resolve Navigation translations',
      navTranslationsResult.reason,
    );
  }

  if (footerTranslationsResult.status === 'fulfilled') {
    const tFooter = footerTranslationsResult.value;
    footerNetworkLabel = tFooter('network');
    footerLegalLabel = tFooter('legal');
    footerHyphaServicesLabel = tFooter('hyphaServices');
    footerHyphaTokenomicsLabel = tFooter('hyphaTokenomics');
    footerLicensingPolicyLabel = tFooter('licensingPolicy');
    footerTermsAndConditionsLabel = tFooter('termsAndConditions');
    footerPrivacyPolicyLabel = tFooter('privacyPolicy');
  } else {
    console.error(
      '[app/layout] Failed to resolve Footer translations',
      footerTranslationsResult.reason,
    );
  }

  if (aiChatEnabledResult.status === 'fulfilled') {
    aiChatEnabled = aiChatEnabledResult.value === true;
  } else {
    console.error(
      '[app/layout] Failed to resolve aiChatEnabled',
      aiChatEnabledResult.reason,
    );
  }

  if (spaceMemoryEnabledResult.status === 'fulfilled') {
    spaceMemoryEnabled = spaceMemoryEnabledResult.value === true;
  } else {
    console.error(
      '[app/layout] Failed to resolve spaceMemoryEnabled',
      spaceMemoryEnabledResult.reason,
    );
  }

  if (humanChatEnabledResult.status === 'fulfilled') {
    humanChatEnabled = humanChatEnabledResult.value === true;
  } else {
    console.error(
      '[app/layout] Failed to resolve humanChatEnabled',
      humanChatEnabledResult.reason,
    );
  }

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
          <AppNavigationSessionCounter />
          <NextIntlClientProvider locale={locale} messages={messages}>
            <TooltipProvider>
              <NotificationSubscriber
                appId={notificationAppId}
                safariWebId={safariWebId}
                serviceWorkerPath={serviceWorkerPath}
              >
                <ConditionalMatrixProvider enabled={humanChatEnabled}>
                  <PanelProviders>
                    <GlobalCallDockProvider>
                      <PanelWrapLayout
                        left={
                          aiChatEnabled
                            ? {
                                content: (
                                  <AiLeftPanel
                                    enableSpaceMemory={spaceMemoryEnabled}
                                  />
                                ),
                              }
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
                            openMenuLabel={navOpenMenuLabel}
                            closeMenuLabel={navCloseMenuLabel}
                            leadingAction={
                              aiChatEnabled ? (
                                <div className="md:hidden">
                                  <AiSidebarTrigger />
                                </div>
                              ) : undefined
                            }
                            trailingAction={
                              humanChatEnabled ? (
                                <HumanSidebarTrigger />
                              ) : undefined
                            }
                            mobileAction={
                              <ConnectedButtonProfile
                                useAuthentication={useAuthentication}
                                useMe={useMe}
                                newUserRedirectPath="/profile/signup"
                                baseRedirectPath="/my-spaces"
                                navItems={[
                                  {
                                    label: navMySpacesLabel,
                                    href: `/${locale}/my-spaces`,
                                  },
                                  {
                                    label: navNetworkLabel,
                                    href: `/${locale}/network`,
                                  },
                                ]}
                                trailingBeforeProfile={
                                  isLanguageSelectVisible ? (
                                    <ConnectedLanguageSelect
                                      selectLanguageLabel={
                                        navSelectLanguageLabel
                                      }
                                    />
                                  ) : undefined
                                }
                                compact
                              />
                            }
                          >
                            <div className="flex max-md:pointer-events-none max-md:opacity-0">
                              <ConnectedButtonProfile
                                useAuthentication={useAuthentication}
                                useMe={useMe}
                                newUserRedirectPath="/profile/signup"
                                baseRedirectPath="/my-spaces"
                                navItems={[
                                  {
                                    label: navMySpacesLabel,
                                    href: `/${locale}/my-spaces`,
                                  },
                                  {
                                    label: navNetworkLabel,
                                    href: `/${locale}/network`,
                                  },
                                ]}
                                trailingBeforeProfile={
                                  isLanguageSelectVisible ? (
                                    <ConnectedLanguageSelect
                                      selectLanguageLabel={
                                        navSelectLanguageLabel
                                      }
                                    />
                                  ) : undefined
                                }
                              />
                            </div>
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
                          networkLabel={footerNetworkLabel}
                          legalLabel={footerLegalLabel}
                          hyphaServicesLabel={footerHyphaServicesLabel}
                          hyphaTokenomicsLabel={footerHyphaTokenomicsLabel}
                          licensingPolicyLabel={footerLicensingPolicyLabel}
                          termsAndConditionsLabel={
                            footerTermsAndConditionsLabel
                          }
                          privacyPolicyLabel={footerPrivacyPolicyLabel}
                        />
                      </PanelWrapLayout>
                      {humanChatEnabled && <ConnectedGlobalCallDock />}
                    </GlobalCallDockProvider>
                  </PanelProviders>
                </ConditionalMatrixProvider>
              </NotificationSubscriber>
            </TooltipProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </AuthProvider>
      {shouldInjectToolbar && <VercelToolbar />}
    </Html>
  );
}
