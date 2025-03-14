import invariant from 'tiny-invariant';
import { base } from '@wagmi/core/chains';
import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from 'packages/core-evm/src/generated';
import { useWallets } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { useAuthentication } from '@hypha-platform/authentication';
import { createSpaceSchema } from '@hypha-platform/epics';
import { parseEventLogs } from 'viem';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { z } from 'zod';
import React from 'react';

export const useCreateSpace = () => {
  const { wallets } = useWallets();
  const { user } = useAuthentication();

  const { setActiveWallet } = useSetActiveWallet();

  const { address } = useAccount();
  const {
    data: hash,
    writeContract,
    isSuccess: isWriteContractSuccess,
    isError: isWriteContractError,
  } = useWriteContract();
  const { data: transactionData } = useWaitForTransactionReceipt({ hash });
  console.debug('CreateSpacePage', { address, transactionData });

  React.useEffect(() => {
    if (user) {
      const activeWallet = wallets.find(
        (wallet) => wallet.address === user?.wallet?.address,
      );
      invariant(activeWallet, 'User needs to be connected');

      setActiveWallet(activeWallet);
    }
  }, [user, setActiveWallet]);

  const spaceId = React.useMemo(() => {
    if (transactionData) {
      try {
        // Parse logs for the specific event in one step
        const spaceCreatedEvents = parseEventLogs({
          abi: daoSpaceFactoryImplementationAbi,
          logs: transactionData.logs,
          eventName: 'SpaceCreated',
        });

        if (spaceCreatedEvents.length > 0) {
          const event = spaceCreatedEvents[0];
          console.debug('useMemo spaceId', { event });
          return Number(event.args.spaceId);
        }
      } catch (error) {
        console.error('Failed to parse SpaceCreated event:', error);
      }
    }
    return undefined;
  }, [transactionData]);

  const handleCreateSpace = React.useCallback(
    async ({
      unity,
      quorum,
      votingPowerSource,
      exitMethod,
      joinMethod,
    }: z.infer<typeof createSpaceSchema>) => {
      writeContract({
        address: daoSpaceFactoryImplementationAddress[base.id],
        abi: daoSpaceFactoryImplementationAbi,
        functionName: 'createSpace',
        args: [
          {
            unity: BigInt(unity),
            quorum: BigInt(quorum),
            votingPowerSource: BigInt(votingPowerSource),
            exitMethod: BigInt(exitMethod),
            joinMethod: BigInt(joinMethod),
          },
        ],
      });
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
