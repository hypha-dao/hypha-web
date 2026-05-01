import { NextSSRPlugin } from '@uploadthing/react/next-ssr-plugin';
import { extractRouterConfig } from 'uploadthing/server';
import { Lato, Source_Sans_3 } from 'next/font/google';
import clsx from 'clsx';

import { Html, ThemeProvider } from '@hypha-platform/ui/server';
import { AuthProvider } from '@hypha-platform/authentication';
import { EvmProvider } from '@hypha-platform/evm';
import { fileRouter } from '@hypha-platform/core/server';

import { MenuTop } from '@hypha-platform/ui';

import '@hypha-platform/ui-utils/global.css';
import { ThemeStorageNormalize } from '@web/components/theme-storage-normalize';

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
  title: 'Hypha - Sign in',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const localScaleGlobalWalletAppId =
    process.env.NEXT_PUBLIC_LOCAL_SCALE_GLOBAL_WALLET_APP_ID?.trim();

  return (
    <Html className={clsx(lato.variable, sourceSans.variable)}>
      <AuthProvider
        config={{
          appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
          globalWalletProviderAppIds: localScaleGlobalWalletAppId
            ? [localScaleGlobalWalletAppId]
            : undefined,
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
            <MenuTop logoHref={`/signin`} />
            <NextSSRPlugin routerConfig={extractRouterConfig(fileRouter)} />
            <div className="h-screen">{children}</div>
          </EvmProvider>
        </ThemeProvider>
      </AuthProvider>
    </Html>
  );
}
