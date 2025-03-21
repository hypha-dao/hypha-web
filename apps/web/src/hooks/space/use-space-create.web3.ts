import { useWallets } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { useAuthentication } from '@hypha-platform/authentication';
import { schemaCreateSpaceWeb3 } from '@hypha-platform/core/client';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { z } from 'zod';
import React from 'react';
import { createSpace, getSpaceIdFromLogs } from '@hypha-platform/evm';

export const useSpaceCreateWeb3 = () => {
  const { wallets } = useWallets();
  const { user } = useAuthentication();

  const { setActiveWallet } = useSetActiveWallet();

  const {
    data: hash,
    writeContract,
    isPending: isWriteContractPending,
    isSuccess: isWriteContractSuccess,
    isError: isWriteContractError,
  } = useWriteContract();
  const { data: transactionData, isLoading: isLoadingTransaction } =
    useWaitForTransactionReceipt({ hash });

  const resetWallet = React.useCallback(async () => {
    if (user) {
      const activeWallet = wallets.find(
        (wallet) => wallet.address === user?.wallet?.address,
      );

      if (activeWallet) {
        return await setActiveWallet(activeWallet);
      }
    }
  }, [user, setActiveWallet]);

  const spaceId = React.useMemo(
    () => getSpaceIdFromLogs(transactionData?.logs || []),
    [transactionData],
  );

  const handleCreateSpace = React.useCallback(
    async ({
      unity,
      quorum,
      votingPowerSource,
      exitMethod,
      joinMethod,
    }: z.infer<typeof schemaCreateSpaceWeb3>) => {
      await resetWallet();
      writeContract(
        createSpace({
          unity: BigInt(unity),
          quorum: BigInt(quorum),
          votingPowerSource: BigInt(votingPowerSource),
          exitMethod: BigInt(exitMethod),
          joinMethod: BigInt(joinMethod),
        }),
      );
    },
    [writeContract],
  );
  return {
    createSpace: handleCreateSpace,
    spaceId,
    isLoading: !spaceId,
    isWriteContractError,
    isWriteContractSuccess,
  };
};
