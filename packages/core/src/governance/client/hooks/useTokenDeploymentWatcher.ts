import { useCallback, useEffect, useRef } from 'react';
import { publicClient } from '@hypha-platform/core/client';
import {
  regularTokenFactoryAbi,
  ownershipTokenFactoryAbi,
  decayingTokenFactoryAbi,
} from '@hypha-platform/core/generated';
import { UpdateTokenInput } from '../../types';

export const useTokenDeploymentWatcher = ({
  proposalId,
  updateToken,
}: {
  proposalId: number;
  updateToken: (input: UpdateTokenInput) => Promise<unknown>;
}) => {
  const tokenDeployedUnwatchRef = useRef<(() => void) | null>(null);

  const setupWatcher = useCallback(
    (transactionHash: `0x${string}`) => {
      tokenDeployedUnwatchRef.current?.();

      const unwatch = publicClient.watchContractEvent({
        address: undefined,
        abi: [
          ...regularTokenFactoryAbi,
          ...ownershipTokenFactoryAbi,
          ...decayingTokenFactoryAbi,
        ],
        eventName: 'TokenDeployed',
        onLogs: async (tokenLogs) => {
          for (const tokenLog of tokenLogs) {
            if (tokenLog.transactionHash === transactionHash) {
              const tokenAddress = tokenLog.args.tokenAddress as string;
              try {
                await updateToken({
                  agreementWeb3Id: proposalId,
                  address: tokenAddress,
                });
                console.log(
                  'Token updated via TokenDeployed event:',
                  tokenAddress,
                );
                unwatch();
                tokenDeployedUnwatchRef.current = null;
                return;
              } catch (error) {
                console.error(
                  'Error updating token via TokenDeployed event:',
                  error,
                );
              }
            }
          }
        },
        onError: (error) => {
          console.error('Error watching TokenDeployed events:', error);
        },
      });

      tokenDeployedUnwatchRef.current = unwatch;

      setTimeout(() => {
        console.log('TokenDeployed watcher timeout for proposal:', proposalId);
        unwatch();
        tokenDeployedUnwatchRef.current = null;
      }, 30000);
    },
    [proposalId, updateToken],
  );

  useEffect(() => {
    return () => {
      tokenDeployedUnwatchRef.current?.();
      tokenDeployedUnwatchRef.current = null;
    };
  }, []);

  return { setupTokenDeployedWatcher: setupWatcher };
};
