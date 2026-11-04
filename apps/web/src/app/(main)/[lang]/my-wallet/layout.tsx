import { Suspense } from 'react';

import { WalletColumnScrollReset } from './_components/wallet-column-scroll-reset';

export const metadata = {
  title: 'Hypha | My Wallet',
  description: 'View your wallet, banking, transactions, and rewards.',
};

export default async function MyWalletLayout({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full">
      <Suspense fallback={null}>
        <WalletColumnScrollReset />
      </Suspense>
      {children}
      {aside}
    </div>
  );
}
