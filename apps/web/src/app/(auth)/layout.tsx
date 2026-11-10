import type { Metadata, Viewport } from 'next';

import { hyphaFontVariables } from '@web/lib/hypha-fonts';
import { Html, ThemeProvider } from '@hypha-platform/ui/server';
import { AuthProvider } from '@hypha-platform/authentication';
import { Logo, TooltipProvider } from '@hypha-platform/ui';

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
 * Hypha mark, the theme and the Privy provider the login page needs.
 */
export default function AuthServerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Html lang="en" className={hyphaFontVariables}>
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
            <main className="flex-1 overflow-y-auto">{children}</main>
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </Html>
  );
}
