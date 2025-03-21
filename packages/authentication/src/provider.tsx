'use client';

import { PrivyProvider, PrivyProviderProps } from '@privy-io/react-auth';
import React from 'react';
import { PrivyAuthProvider } from './privy/provider';
import { Web3AuthAuthProvider } from './web3auth/provider';
import { Web3AuthProvider } from '@web3auth/modal-react-hooks';
import { web3AuthContextConfig } from './web3auth/config';
import { base } from '@wagmi/core/chains';
import { EvmProvider } from '@hypha-platform/evm';

export type AuthProviderBaseConfig = {
  type: 'privy' | 'web3auth';
};

export type PrivyAuthProviderConfig = AuthProviderBaseConfig & {
  type: 'privy';
  appId: string;
};

export type Web3AuthProviderConfig = AuthProviderBaseConfig & {
  type: 'web3auth';
  clientId: string;
};

type AuthProviderProps = {
  children: React.ReactNode;
  config: PrivyAuthProviderConfig | Web3AuthProviderConfig;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  ...providerProps
}) => {
  switch (providerProps.config.type) {
    case 'privy':
      return (
        <PrivyProvider
          config={{ defaultChain: base }}
          appId={providerProps.config.appId}
        >
          <EvmProvider>
            <PrivyAuthProvider>{children}</PrivyAuthProvider>
          </EvmProvider>
        </PrivyProvider>
      );
    case 'web3auth':
      return (
        <Web3AuthProvider
          config={{
            ...web3AuthContextConfig,
            web3AuthOptions: {
              ...web3AuthContextConfig.web3AuthOptions,
              clientId: providerProps.config.clientId,
            },
          }}
        >
          <EvmProvider>
            <Web3AuthAuthProvider>{children}</Web3AuthAuthProvider>
          </EvmProvider>
        </Web3AuthProvider>
      );
  }
};
