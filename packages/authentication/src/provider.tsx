'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { SmartWalletsProvider } from '@privy-io/react-auth/smart-wallets';

import React from 'react';
import { base } from '@wagmi/core/chains';
import { EvmProvider } from '@hypha-platform/evm';
import { LOCAL_SCALE_GLOBAL_WALLET_LOGIN_METHOD } from './global-wallets';

export type PrivyAuthProviderConfig = {
  appId: string;
};

type AuthProviderProps = {
  children: React.ReactNode;
  config: PrivyAuthProviderConfig;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  ...providerProps
}) => {
  return (
    <PrivyProvider
      config={{
        defaultChain: base,
        loginMethodsAndOrder: {
          primary: [LOCAL_SCALE_GLOBAL_WALLET_LOGIN_METHOD, 'email'],
          overflow: ['detected_ethereum_wallets'],
        },
      }}
      appId={providerProps.config.appId}
    >
      <SmartWalletsProvider>
        <EvmProvider>{children}</EvmProvider>
      </SmartWalletsProvider>
    </PrivyProvider>
  );
};
