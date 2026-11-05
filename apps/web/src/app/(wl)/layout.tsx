import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getLocale, getMessages } from 'next-intl/server';
import { defaultMessages } from '@hypha-platform/i18n/messages';
import { Html, ThemeProvider } from '@hypha-platform/ui/server';
import { AnonymousAuthProvider } from '@hypha-platform/authentication';
import { TooltipProvider } from '@hypha-platform/ui';
import {
  GlobalCallDockProvider,
  MemberPresenceProvider,
  PanelProviders,
  SpacesRailProvider,
} from '@hypha-platform/epics';

import { hyphaFontVariables } from '@web/lib/hypha-fonts';
import { LocalizedIntlProvider } from '@web/components/localized-intl-provider';
import { ConditionalMatrixProvider } from '@web/components/conditional-matrix-provider';
import { SwrProvider } from '@web/components/swr-provider';
import { ThemeStorageNormalize } from '@web/components/theme-storage-normalize';
import {
  WhiteLabelLinkGuard,
  WhiteLabelProvider,
} from '@web/components/white-label/white-label-provider';
import { WL_MODE_HEADER, WL_SPACE_HEADER } from '@web/lib/white-label';

import '@hypha-platform/ui-utils/global.css';
import 'react-tooltip/dist/react-tooltip.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Hypha',
  // A framed view of a Space is not a page to index on its own.
  robots: { index: false, follow: false },
};

/**
 * Root layout of the white-label tree (second root layout next to `(main)`).
 * It resolves nothing: middleware does, and sets the request headers read here.
 * Without them (a direct request to /wl/...) it renders the 404.
 *
 * No `AuthProvider`: this tree is read-only and mounts no Privy. The visitor
 * is always signed out (`AnonymousAuthProvider`).
 */
export default async function WhiteLabelRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const spaceSlug = requestHeaders.get(WL_SPACE_HEADER);
  if (!spaceSlug || requestHeaders.get(WL_MODE_HEADER) !== 'embed') {
    notFound();
  }

  let locale = 'en';
  let messages: Record<string, unknown> = defaultMessages;
  try {
    locale = await getLocale();
    messages = await getMessages();
  } catch (error) {
    console.error('[wl/layout] Failed to resolve locale or messages', error);
  }

  return (
    <Html lang={locale} className={hyphaFontVariables}>
      <AnonymousAuthProvider>
        <SwrProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            storageKey="theme"
            disableTransitionOnChange
          >
            <ThemeStorageNormalize />
            <LocalizedIntlProvider locale={locale} messages={messages}>
              <TooltipProvider>
                <WhiteLabelProvider
                  value={{ mode: 'embed', spaceSlug, lang: locale }}
                >
                  {/* Context providers the shared sections read. Matrix, chat
                      panels, notifications and the call dock UI are not mounted. */}
                  <ConditionalMatrixProvider enabled={false}>
                    <MemberPresenceProvider>
                      <PanelProviders>
                        <SpacesRailProvider>
                          <GlobalCallDockProvider>
                            <WhiteLabelLinkGuard>
                              <div className="w-full min-h-screen bg-page-background">
                                {children}
                              </div>
                            </WhiteLabelLinkGuard>
                          </GlobalCallDockProvider>
                        </SpacesRailProvider>
                      </PanelProviders>
                    </MemberPresenceProvider>
                  </ConditionalMatrixProvider>
                </WhiteLabelProvider>
              </TooltipProvider>
            </LocalizedIntlProvider>
          </ThemeProvider>
        </SwrProvider>
      </AnonymousAuthProvider>
    </Html>
  );
}
