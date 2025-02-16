import {
  Footer,
  Html,
  MenuTop,
  ThemeProvider,
} from '@hypha-platform/ui/server';
import '@hypha-platform/ui-utils/global.css';
import { VercelToolbar } from '@vercel/toolbar/next';

import { Lato, Source_Sans_3 } from 'next/font/google';
import clsx from 'clsx';
import { ConnectedButtonProfile } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { AuthProvider } from '@hypha-platform/authentication';
import { enableWeb3Auth } from '@hypha-platform/feature-flags';

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

export const metadata = {
  title: 'Welcome to web',
  description: 'Generated by create-nx-workspace',
};

export default async function RootLayout({
  children,
  aside,
  params,
}: {
  children: React.ReactNode;
  aside: React.ReactNode;
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await params;

  const isWeb3AuthEnabled = await enableWeb3Auth();
  const shouldInjectToolbar = process.env.NODE_ENV === 'development';
  return (
    <Html className={clsx(lato.variable, sourceSans.variable)}>
      <AuthProvider
        config={
          isWeb3AuthEnabled
            ? {
                type: 'web3auth' as const,
                clientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!,
              }
            : {
                type: 'privy' as const,
                appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
              }
        }
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <MenuTop
            withLogo={true}
            navItems={[
              {
                label: 'Network',
                href: `/${lang}/network`,
              },
              {
                label: 'My Spaces',
                href: `/${lang}/my-spaces`,
              },
              {
                label: 'Wallet',
                href: `/${lang}/wallet`,
              },
            ]}
          >
            <MenuTop.RightSlot>
              <ConnectedButtonProfile />
            </MenuTop.RightSlot>
          </MenuTop>
          <div className="pt-9 w-screen flex justify-normal">
            <div className="w-full">{children}</div>
            {aside}
          </div>
          <Footer />
        </ThemeProvider>
      </AuthProvider>
      {shouldInjectToolbar && <VercelToolbar />}
    </Html>
  );
}
