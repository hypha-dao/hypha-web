import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getLocale, getMessages } from 'next-intl/server';
import { getAppBaseUrl } from '@hypha-platform/core/server';
import { defaultMessages } from '@hypha-platform/i18n/messages';
import { Html, ThemeProvider } from '@hypha-platform/ui/server';
import { TooltipProvider } from '@hypha-platform/ui';
import {
  ActionCapabilitiesProvider,
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
import { WhiteLabelAuthProvider } from '@web/components/white-label/auth-seam';
import {
  WL_AUTH_HEADER,
  WL_DETAIL_VIEW_HEADER,
  WL_MODE_HEADER,
  WL_SPACE_HEADER,
  WL_UNSUPPORTED_ACTIONS_HEADER,
  authKindFor,
  readAuthConfigHeader,
  type WhiteLabelLinkContext,
  type WhiteLabelMode,
} from '@web/lib/white-label';

import '@hypha-platform/ui-utils/global.css';
import './wl-overlay.css';
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
 * The mode (`embed` on the main host, `host` on a mapped host) picks the auth
 * provider through `WhiteLabelAuthProvider`. The iframe is signed out and
 * mounts no Privy; a mapped host with login settings mounts Privy on its own
 * client (the sections stay read-only: writes are a later step).
 */
export default async function WhiteLabelRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const spaceSlug = requestHeaders.get(WL_SPACE_HEADER);
  const mode = requestHeaders.get(WL_MODE_HEADER);
  if (!spaceSlug || (mode !== 'embed' && mode !== 'host')) {
    notFound();
  }
  const whiteLabelMode: WhiteLabelMode = mode;
  // Only an explicit `embedded` serves the details (fail closed).
  const detailView =
    requestHeaders.get(WL_DETAIL_VIEW_HEADER) === 'embedded'
      ? 'embedded'
      : 'full-app';
  // Only an explicit `full-app` shows unsupported actions (fail closed: hide).
  const unsupportedActions =
    requestHeaders.get(WL_UNSUPPORTED_ACTIONS_HEADER) === 'full-app'
      ? 'full-app'
      : 'hide';
  const authConfig =
    whiteLabelMode === 'host'
      ? readAuthConfigHeader(requestHeaders.get(WL_AUTH_HEADER))
      : null;

  let locale = 'en';
  let messages: Record<string, unknown> = defaultMessages;
  try {
    locale = await getLocale();
    messages = await getMessages();
  } catch (error) {
    console.error('[wl/layout] Failed to resolve locale or messages', error);
  }

  const linkContext: WhiteLabelLinkContext =
    whiteLabelMode === 'host'
      ? {
          mode: 'host',
          spaceSlug,
          lang: locale,
          fullAppOrigin: getAppBaseUrl(),
          detailView,
          unsupportedActions,
        }
      : {
          mode: 'embed',
          spaceSlug,
          lang: locale,
          detailView,
          unsupportedActions,
        };

  return (
    <Html lang={locale} className={`${hyphaFontVariables} wl-root`}>
      <WhiteLabelAuthProvider mode={whiteLabelMode} authConfig={authConfig}>
        <SwrProvider skipClientErrorRetry>
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
                <WhiteLabelProvider value={linkContext}>
                  <ActionCapabilitiesProvider
                    value={{
                      unsupportedActions,
                      // The iframe is on the full app's origin: relative links work.
                      fullAppOrigin:
                        linkContext.mode === 'host'
                          ? linkContext.fullAppOrigin
                          : '',
                      // Only a signed-in member can read the pipeline.
                      pipelineData:
                        authKindFor(whiteLabelMode, authConfig) === 'privy',
                      // Only a host with login can vote (a signed-in member).
                      voteLive:
                        authKindFor(whiteLabelMode, authConfig) === 'privy',
                    }}
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
                  </ActionCapabilitiesProvider>
                </WhiteLabelProvider>
              </TooltipProvider>
            </LocalizedIntlProvider>
          </ThemeProvider>
        </SwrProvider>
      </WhiteLabelAuthProvider>
    </Html>
  );
}
