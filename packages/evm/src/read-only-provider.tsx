'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import React from 'react';
import { config } from './config';

/**
 * wagmi + react-query without Privy, for trees that only read chain state
 * (the white-label tree). The same `config` as `EvmProvider`; no wallet
 * connector is attached, so only public-client reads work.
 */
export const ReadOnlyEvmProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [queryClient] = React.useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>{children}</WagmiProvider>
    </QueryClientProvider>
  );
};
