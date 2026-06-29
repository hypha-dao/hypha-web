import { useCallback } from 'react';
import { publicClient, getProposalDetails } from '@hypha-platform/core/client';
import {
  regularTokenFactoryAbi,
  ownershipTokenFactoryAbi,
  decayingTokenFactoryAbi,
} from '@hypha-platform/core/generated';
import { decodeFunctionData } from 'viem';

export const useProposalActions = () => {
  const fetchProposalActions = useCallback(async (proposalId: number) => {
    try {
      const data = await publicClient.readContract(
        getProposalDetails({ proposalId: BigInt(proposalId) }),
      );
      const transactions = data[9];
      const actions: string[] = [];

      (transactions as any[]).forEach((tx) => {
        try {
          const decodedRegular = decodeFunctionData({
            abi: regularTokenFactoryAbi,
            data: tx.data,
          });
          if (
            decodedRegular.functionName === 'deployToken' ||
            decodedRegular.functionName === 'deployTokenWithMinters'
          ) {
            actions.push(decodedRegular.functionName);
            return;
          }
        } catch {}

        try {
          const decodedOwnership = decodeFunctionData({
            abi: ownershipTokenFactoryAbi,
            data: tx.data,
          });
          if (
            decodedOwnership.functionName === 'deployOwnershipToken' ||
            decodedOwnership.functionName === 'deployOwnershipTokenWithMinters'
          ) {
            actions.push(decodedOwnership.functionName);
            return;
          }
        } catch {}

        try {
          const decodedDecaying = decodeFunctionData({
            abi: decayingTokenFactoryAbi,
            data: tx.data,
          });
          if (
            decodedDecaying.functionName === 'deployDecayingToken' ||
            decodedDecaying.functionName === 'deployDecayingTokenWithMinters'
          ) {
            actions.push(decodedDecaying.functionName);
            return;
          }
        } catch {}
      });

      return actions;
    } catch (error) {
      console.error('Failed to fetch proposal actions:', error);
      return [];
    }
  }, []);

  const isValidProposalAction = useCallback((actions: string[]) => {
    const validActions = [
      'deployToken',
      'deployOwnershipToken',
      'deployDecayingToken',
      'deployTokenWithMinters',
      'deployOwnershipTokenWithMinters',
      'deployDecayingTokenWithMinters',
    ];
    return (
      actions.length > 0 &&
      actions.every((action) => validActions.includes(action))
    );
  }, []);

  return { fetchProposalActions, isValidProposalAction };
};
