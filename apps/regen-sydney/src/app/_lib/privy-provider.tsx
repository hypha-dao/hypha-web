'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { base } from 'viem/chains';

/**
 * Same Privy app as Hypha, so a member's `sub` — and therefore their wallet —
 * is the same on both properties, even though the campaign stores its own
 * member record in its own database rather than sharing Hypha's.
 *
 * Login is email and Google only: this is a public fundraising page, and
 * asking a donor to connect a wallet would lose most of them. Privy creates an
 * embedded wallet silently on first login, and the relayer pays for the mint,
 * so nobody is ever asked to sign or fund a transaction.
 */
export function RsPrivyProvider({
  appId,
  children,
}: {
  appId: string;
  children: React.ReactNode;
}) {
  if (!appId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        defaultChain: base,
        supportedChains: [base],
        loginMethods: ['google', 'email'],
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          showWalletUIs: false,
        },
        appearance: {
          theme: 'light',
          accentColor: '#c86a2e',
          logo: '/media/rs-logo.webp',
          landingHeader: 'Join the Regen Sydney round',
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
