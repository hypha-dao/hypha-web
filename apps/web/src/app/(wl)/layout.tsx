// SPIKE #2616: separate root layout for the white-label tree. No global shell.
import { headers } from 'next/headers';
import { getLocale, getMessages } from 'next-intl/server';
import { defaultMessages } from '@hypha-platform/i18n/messages';
import { Html, ThemeProvider } from '@hypha-platform/ui/server';
import { TooltipProvider } from '@hypha-platform/ui';
import { AuthProvider } from '@hypha-platform/authentication';
import { EvmProvider } from '@hypha-platform/evm';
import { GlobalCallDockProvider } from '@hypha-platform/epics';
import { hyphaFontVariables } from '@web/lib/hypha-fonts';
import { LocalizedIntlProvider } from '@web/components/localized-intl-provider';
import { SwrProvider } from '@web/components/swr-provider';
import '@hypha-platform/ui-utils/global.css';

export const dynamic = 'force-dynamic';

export default async function WhiteLabelRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // SPIKE: provider variant picked by request header x-wl-providers: none | evm | auth
  const mode = (await headers()).get('x-wl-providers') ?? 'auth';
  const locale = await getLocale().catch(() => 'en');
  const messages = (await getMessages().catch(() => defaultMessages)) as Record<
    string,
    unknown
  >;
  const inner =
    mode === 'none' ? (
      children
    ) : mode === 'evm' ? (
      <EvmProvider>{children}</EvmProvider>
    ) : (
      <AuthProvider config={{ appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID! }}>
        {children}
      </AuthProvider>
    );
  return (
    <Html lang={locale} className={hyphaFontVariables}>
      <SwrProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="theme"
          disableTransitionOnChange
        >
          <LocalizedIntlProvider locale={locale} messages={messages}>
            <TooltipProvider>
              {mode === 'none' ? (
                inner
              ) : (
                <GlobalCallDockProvider>{inner}</GlobalCallDockProvider>
              )}
            </TooltipProvider>
          </LocalizedIntlProvider>
        </ThemeProvider>
      </SwrProvider>
    </Html>
  );
}
