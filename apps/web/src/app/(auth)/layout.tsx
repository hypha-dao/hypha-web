import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';

import { hyphaFontVariables } from '@web/lib/hypha-fonts';
import { Html, ThemeProvider } from '@hypha-platform/ui/server';
import { AuthProvider } from '@hypha-platform/authentication';
import { Logo, TooltipProvider } from '@hypha-platform/ui';
import { routing } from '@hypha-platform/i18n/routing';
import {
  AUTH_SERVER_LANG_COOKIE,
  resolveAuthLocale,
} from '@hypha-platform/auth-server/client';

import '@hypha-platform/ui-utils/global.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Hypha',
  robots: { index: false, follow: false },
};

/**
 * Root layout of the authorization server pages (login, consent). Separate from the
 * app's layout on purpose: no app chrome, no panels, no language routing; only the
 * Hypha mark, the theme and the Privy provider the login page needs. The pages pick their
 * language themselves (see auth/_lib/intl.tsx); `lang` here follows the cookie and the browser,
 * and the page corrects it when `?lang=` was used.
 */
export default async function AuthServerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const { locale } = resolveAuthLocale({
    cookie: cookieStore.get(AUTH_SERVER_LANG_COOKIE)?.value,
    acceptLanguage: headerStore.get('accept-language'),
    supported: routing.locales,
    fallback: routing.defaultLocale,
  });
  return (
    <Html lang={locale} className={hyphaFontVariables}>
      <AuthProvider config={{ appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID! }}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="theme"
          disableTransitionOnChange
        >
          <TooltipProvider>
            <header className="flex h-14 shrink-0 items-center justify-center border-b border-border bg-page-background px-4">
              <Logo width={96} />
            </header>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </Html>
  );
}
