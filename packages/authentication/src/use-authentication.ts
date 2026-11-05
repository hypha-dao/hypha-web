'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import React from 'react';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { useRouter } from 'next/navigation';
import { saveAuthReturnPath } from './auth-return-path';
import { clearOnboardingWalletSessionActive } from './onboarding-wallet-session';
import { AnonymousAuthContext, useAnonymousAuthentication } from './anonymous';

function usePrivyAuthentication() {
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
  const previousPrivyUserIdRef = React.useRef<string | undefined>(undefined);

  const smartWallet = React.useMemo(() => {
    return privyUser?.linkedAccounts?.find(
      (account) => account.type === 'smart_wallet',
    );
  }, [privyUser]);

  React.useEffect(() => {
    const activeWallet = wallets.find(
      (wallet) => wallet.address === smartWallet?.address,
    );

    if (activeWallet) {
      setActiveWallet(activeWallet);
    }
  }, [smartWallet?.address, wallets, setActiveWallet]);

  React.useEffect(() => {
    const currentUserId = privyUser?.id;
    const previousUserId = previousPrivyUserIdRef.current;

    if (previousUserId && currentUserId && previousUserId !== currentUserId) {
      clearOnboardingWalletSessionActive();
    }

    previousPrivyUserIdRef.current = currentUserId;
  }, [privyUser?.id]);

  React.useEffect(() => {
    if (ready && !authenticated) {
      clearOnboardingWalletSessionActive();
    }
  }, [authenticated, ready]);

  const openLoginModal = React.useCallback((): void => {
    privyLogin();
  }, [privyLogin]);

  const login = React.useCallback(async (): Promise<void> => {
    if (typeof window !== 'undefined') {
      saveAuthReturnPath(window.location.pathname);
    }
    openLoginModal();
    setLoggingIn(true);
  }, [openLoginModal]);

  const logout = React.useCallback(
    async (redirect: boolean = true): Promise<void> => {
      clearOnboardingWalletSessionActive();
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
    openLoginModal,
    logout,
    isLoggingIn,
    setLoggingIn,
    getAccessToken,
    exportWallet: handleExportWallet,
    isModalOpen,
  };
}

/**
 * Authentication state for the current tree. Under `AnonymousAuthProvider`
 * (the white-label tree, which mounts no Privy) it is always signed out; under
 * `AuthProvider` it is the Privy-backed state.
 *
 * The branch depends on a context set once by a root layout, so it never
 * changes for the lifetime of a mounted tree and the hook order is stable.
 */
export function useAuthentication(): ReturnType<typeof usePrivyAuthentication> {
  const anonymous = React.useContext(AnonymousAuthContext);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return anonymous ? useAnonymousAuthentication() : usePrivyAuthentication();
}
