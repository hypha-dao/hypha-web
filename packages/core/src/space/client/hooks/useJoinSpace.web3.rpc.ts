import { joinSpace } from '../web3/dao-space-factory/join-space';
import { writeContract } from '@wagmi/core';
import useSWRMutation from 'swr/mutation';
import { useConfig } from 'wagmi';

export const useJoinSpaceWeb3Rpc = ({ spaceId }: { spaceId: number }) => {
  const config = useConfig();

  const {
    trigger: joinSpaceMutation,
    reset: resetJoinSpaceMutation,
    isMutating: isJoiningSpace,
    data: joinSpaceHash,
    error: errorJoinSpace,
  } = useSWRMutation(
    config ? [config, spaceId, 'joinSpaceWeb3'] : null,
    async ([config, spaceId]) => {
      return writeContract(config, joinSpace({ spaceId: BigInt(spaceId) }));
    },
  );

  return {
    joinSpace: joinSpaceMutation,
    resetJoinSpaceMutation,
    isJoiningSpace,
    joinSpaceHash,
    errorJoinSpace,
  };
};
