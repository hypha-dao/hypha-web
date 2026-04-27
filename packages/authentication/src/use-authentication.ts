'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import React from 'react';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { useRouter } from 'next/navigation';
import { LOCAL_SCALE_GLOBAL_WALLET_APP_ID } from './global-wallets';

type CrossAppAccountWithWallets = {
  type: 'cross_app';
  providerApp?: {
    id?: string;
  };
  embeddedWallets?: {
    address?: string;
  }[];
};

const isEvmAddress = (
  address: string | null | undefined,
): address is `0x${string}` =>
  typeof address === 'string' && address.startsWith('0x');

const getLocalScaleWalletAddress = (
  linkedAccounts: ReadonlyArray<unknown> | undefined,
): `0x${string}` | undefined => {
  const localScaleAccount = linkedAccounts?.find(
    (account): account is CrossAppAccountWithWallets => {
      if (!account || typeof account !== 'object') return false;

      const candidate = account as CrossAppAccountWithWallets;
      return (
        candidate.type === 'cross_app' &&
        candidate.providerApp?.id === LOCAL_SCALE_GLOBAL_WALLET_APP_ID
      );
    },
  );
  const address = localScaleAccount?.embeddedWallets?.[0]?.address;

  return isEvmAddress(address) ? address : undefined;
};

export function useAuthentication() {
  const {
    user: privyUser,
    authenticated,
    ready,
    login: privyLogin,
    logout: privyLogout,
    getAccessToken,
    exportWallet,
    isModalOpen,
  } = usePrivy();

  const { wallets } = useWallets();
  const router = useRouter();
  const { setActiveWallet } = useSetActiveWallet();
  const [isLoggingIn, setLoggingIn] = React.useState(false);

  const smartWallet = React.useMemo(() => {
    return privyUser?.linkedAccounts?.find(
      (account) => account.type === 'smart_wallet',
    );
  }, [privyUser]);

  const localScaleWalletAddress = React.useMemo(
    () => getLocalScaleWalletAddress(privyUser?.linkedAccounts),
    [privyUser?.linkedAccounts],
  );

  const smartWalletAddress = isEvmAddress(smartWallet?.address)
    ? smartWallet.address
    : undefined;
  const walletAddress = localScaleWalletAddress || smartWalletAddress;

  React.useEffect(() => {
    const activeWallet = wallets.find(
      (wallet) => wallet.address.toLowerCase() === walletAddress?.toLowerCase(),
    );

    if (activeWallet) {
      setActiveWallet(activeWallet);
    }
  }, [walletAddress, wallets, setActiveWallet]);

  const login = React.useCallback(async (): Promise<void> => {
    privyLogin();
    setLoggingIn(true);
  }, [privyLogin]);

  const logout = React.useCallback(
    async (redirect: boolean = true): Promise<void> => {
      privyLogout();
      if (redirect) {
        router.push('/network');
      }
      setLoggingIn(false);
    },
    [privyLogout, router],
  );

  const user = React.useMemo(() => {
    if (!authenticated || !privyUser?.id) return null;
    return {
      id: privyUser.id,
      email:
        privyUser.email?.address ||
        privyUser.google?.email ||
        privyUser.apple?.email,
      ...(walletAddress && {
        wallet: { address: walletAddress },
      }),
    };
  }, [privyUser, authenticated, walletAddress]);

  const isEmbeddedWallet = React.useMemo(() => {
    return !!(smartWallet?.smartWalletType === 'coinbase_smart_wallet');
  }, [smartWallet]);

  const handleExportWallet = React.useCallback(async () => {
    if (!isEmbeddedWallet) throw new Error('Not an embedded wallet');
    await exportWallet();
  }, [exportWallet, isEmbeddedWallet]);

  return {
    isAuthenticated: authenticated,
    isLoading: !ready,
    isEmbeddedWallet,
    user,
    login,
    logout,
    isLoggingIn,
    setLoggingIn,
    getAccessToken,
    exportWallet: handleExportWallet,
    isModalOpen,
  };
}
