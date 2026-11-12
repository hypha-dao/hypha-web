'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { SmartWalletsProvider } from '@privy-io/react-auth/smart-wallets';

import React from 'react';
import { base } from '@wagmi/core/chains';
import { EvmProvider } from '@hypha-platform/evm';

export type PrivyAuthProviderConfig = {
  appId: string;
  /**
   * Privy app-client id. Unset in the main app (the app's default client).
   * A white-label host passes its own client, read per request on the server:
   * its cookie domain and allowed origins are settings of that client.
   */
  clientId?: string;
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
      config={{ defaultChain: base }}
      appId={providerProps.config.appId}
      clientId={providerProps.config.clientId}
    >
      <SmartWalletsProvider>
        <EvmProvider>{children}</EvmProvider>
      </SmartWalletsProvider>
    </PrivyProvider>
  );
};
