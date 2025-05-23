import { usePrivy, useWallets } from '@privy-io/react-auth';
import { AuthHook } from '../shared/types';
import React from 'react';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';

export function usePrivyAuthenticationAdapter(): AuthHook {
  const {
    user: privyUser,
    authenticated,
    ready,
    login: privyLogin,
    logout: privyLogout,
    getAccessToken,
    exportWallet,
  } = usePrivy();

  const account = useAccount();
  const { wallets } = useWallets();
  const router = useRouter();

  const { setActiveWallet } = useSetActiveWallet();

  React.useEffect(() => {
    const activeWallet = wallets.find(
      (wallet) => wallet.address === account.address,
    );

    if (activeWallet) {
      setActiveWallet(activeWallet);
    }
  }, [account, wallets, setActiveWallet]);

  const login = React.useCallback(async (): Promise<void> => {
    privyLogin();
  }, [privyLogin]);

  const logout = React.useCallback(async (): Promise<void> => {
    privyLogout();
    router.push('/network');
  }, [privyLogout]);

  const user = React.useMemo(() => {
    if (!authenticated || !privyUser?.id) return null;

    return {
      id: privyUser.id,
      email: privyUser.email?.address,
      ...(privyUser.wallet?.address && {
        wallet: { address: privyUser.wallet.address as `0x${string}` },
      }),
    };
  }, [privyUser, authenticated]);

  const isEmbeddedWallet = React.useMemo(() => {
    const connectedWallet = privyUser?.wallet;
    return !!(
      connectedWallet?.walletClientType === 'privy' &&
      connectedWallet.chainType === 'ethereum'
    );
  }, [privyUser]);

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
