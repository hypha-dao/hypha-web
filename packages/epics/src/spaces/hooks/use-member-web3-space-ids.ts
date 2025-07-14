'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { useMemberWeb3SpaceIdsByWallet } from './use-member-web3-space-ids-by-wallet';

export function useMemberWeb3SpaceIds() {
  const { user } = useAuthentication();
  const {
    web3SpaceIds,
    isLoading,
    error,
  } = useMemberWeb3SpaceIdsByWallet({
    walletAddress: user?.wallet?.address
  });

  return {
    web3SpaceIds,
    isLoading,
    error,
  };
}
