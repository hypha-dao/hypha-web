'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { SmartWalletsProvider } from '@privy-io/react-auth/smart-wallets';

import React from 'react';
import { base } from '@wagmi/core/chains';
import { EvmProvider } from '@hypha-platform/evm';
import { toPrivyGlobalWalletLoginMethod } from './global-wallets';

export type PrivyAuthProviderConfig = {
  appId: string;
  globalWalletProviderAppIds?: string[];
};

type AuthProviderProps = {
  children: React.ReactNode;
  config: PrivyAuthProviderConfig;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  ...providerProps
}) => {
  const globalWalletLoginMethods =
    providerProps.config.globalWalletProviderAppIds?.map(
      toPrivyGlobalWalletLoginMethod,
    ) ?? [];
  const hasGlobalWalletLoginMethods = globalWalletLoginMethods.length > 0;

  return (
    <PrivyProvider
      config={{
        defaultChain: base,
        ...(hasGlobalWalletLoginMethods && {
          loginMethodsAndOrder: {
            primary: ['email', ...globalWalletLoginMethods],
            overflow: ['detected_ethereum_wallets'],
          },
        }),
      }}
      appId={providerProps.config.appId}
    >
      <SmartWalletsProvider>
        <EvmProvider>{children}</EvmProvider>
      </SmartWalletsProvider>
    </PrivyProvider>
  );
};
