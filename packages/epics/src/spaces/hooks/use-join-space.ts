import { isMember as isMemberConfig } from '@core/space/client/web3/dao-space-factory/is-member';
import { publicClient } from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import useSWR from 'swr';
import { useJoinSpaceWeb3Rpc } from '@core/space/client/hooks/useJoinSpace.web3.rpc';

export const useJoinSpace = ({ spaceId }: { spaceId: number }) => {
  const { user } = useAuthentication();
  const { joinSpace: joinSpaceWeb3 } = useJoinSpaceWeb3Rpc({ spaceId });

  const {
    data: isMember,
    isLoading,
    error,
  } = useSWR(
    user?.wallet?.address ? [user.wallet.address, spaceId, 'isMember'] : null,
    async ([address, spaceId]) =>
      publicClient.readContract(
        isMemberConfig({ spaceId: BigInt(spaceId), memberAddress: address }),
      ),
    { revalidateOnFocus: true },
  );

  return {
    isMember,
    isLoading,
    error,
    joinSpace: joinSpaceWeb3,
  };
};
