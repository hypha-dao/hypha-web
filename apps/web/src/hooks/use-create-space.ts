import { useWallets } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { useAuthentication } from '@hypha-platform/authentication';
import { createSpaceSchema } from '@hypha-platform/epics';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { z } from 'zod';
import React from 'react';
import { createSpace, getSpaceIdFromLogs } from '@hypha-platform/core-evm';

export const useCreateSpace = () => {
  const { wallets } = useWallets();
  const { user } = useAuthentication();

  const { setActiveWallet } = useSetActiveWallet();

  const {
    data: hash,
    writeContract,
    isSuccess: isWriteContractSuccess,
    isError: isWriteContractError,
  } = useWriteContract();
  const { data: transactionData } = useWaitForTransactionReceipt({ hash });

  React.useEffect(() => {
    if (user) {
      const activeWallet = wallets.find(
        (wallet) => wallet.address === user?.wallet?.address,
      );

      if (activeWallet) setActiveWallet(activeWallet);
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
    }: z.infer<typeof createSpaceSchema>) => {
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
    hash,
    isWriteContractError,
    isWriteContractSuccess,
  };
};
