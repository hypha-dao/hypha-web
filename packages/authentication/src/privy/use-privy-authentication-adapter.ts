import {
  getAccessToken as getPrivyAccessToken,
  usePrivy,
} from '@privy-io/react-auth';
import { AuthHook } from '../shared/types';
import React from 'react';

export function usePrivyAuthenticationAdapter(): AuthHook {
  const {
    user: privyUser,
    authenticated,
    ready,
    login: privyLogin,
    logout: privyLogout,
    getAccessToken,
  } = usePrivy();

  const login = React.useCallback(async (): Promise<void> => {
    privyLogin();
  }, [privyLogin]);

  const logout = React.useCallback(async (): Promise<void> => {
    privyLogout();
  }, [privyLogout]);

  const user = React.useMemo(() => {
    if (!authenticated || !privyUser?.id) return null;

    return {
      id: privyUser.id,
      email: privyUser.email?.address,
      ...(privyUser.wallet?.address && {
        wallet: { address: privyUser.wallet.address },
      }),
    };
  }, [privyUser, authenticated]);

  return {
    isAuthenticated: authenticated,
    isLoading: !ready,
    user,
    login,
    logout,
    getAccessToken,
  };
}
