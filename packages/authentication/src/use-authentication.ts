'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { AuthHook } from './shared/types';
import React from 'react';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { useRouter } from 'next/navigation';

export function useAuthentication(): AuthHook {
  const {
    user: privyUser,
    authenticated,
    ready,
    login: privyLogin,
    logout: privyLogout,
    getAccessToken,
    exportWallet,
  } = usePrivy();

  const { wallets } = useWallets();
  const router = useRouter();
  const { setActiveWallet } = useSetActiveWallet();

  const smartWallet = React.useMemo(() => {
    return privyUser?.linkedAccounts?.find(
      (account) => account.type === 'smart_wallet',
    );
  }, [privyUser]);

  console.log('smartWallet', smartWallet);

  React.useEffect(() => {
    const activeWallet = wallets.find(
      (wallet) => wallet.address === smartWallet?.address,
    );

    if (activeWallet) {
      setActiveWallet(activeWallet);
    }
  }, [smartWallet?.address, wallets, setActiveWallet]);

  const login = React.useCallback(async (): Promise<void> => {
    privyLogin();
  }, [privyLogin]);

  const logout = React.useCallback(async (): Promise<void> => {
    privyLogout();
    router.push('/network');
  }, [privyLogout, router]);

  const user = React.useMemo(() => {
    if (!authenticated || !privyUser?.id) return null;

    return {
      id: privyUser.id,
      email: privyUser.email?.address,
      ...(smartWallet?.address && {
        wallet: { address: smartWallet.address as `0x${string}` },
      }),
    };
  }, [privyUser, authenticated, smartWallet]);

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
    getAccessToken,
    exportWallet: handleExportWallet,
  };
}
