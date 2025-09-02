'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import {
  daoProposalsImplementationConfig,
  regularTokenFactoryAbi,
  ownershipTokenFactoryAbi,
  decayingTokenFactoryAbi,
} from '@hypha-platform/core/generated';
import {
  getProposalDetails,
  DbToken,
  publicClient,
} from '@hypha-platform/core/client';
import useSWRMutation from 'swr/mutation';
import { decodeFunctionData } from 'viem';
import { deleteTokenAction } from '../../server/actions';
import { DeleteTokenInput } from '../../types';

export const useVote = ({
  proposalId,
  tokenSymbol,
  authToken,
}: {
  proposalId?: number | null;
  tokenSymbol?: string | null;
  authToken?: string | null;
}) => {
  const { address } = useAccount();
  const { client } = useSmartWallets();
  const [isVoting, setIsVoting] = useState(false);
  const [isCheckingExpiration, setIsCheckingExpiration] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { trigger: fetchTokens } = useSWRMutation<DbToken[]>(
    ['findAllTokens', tokenSymbol],
    async () => {
      try {
        const res = await fetch(
          `/api/v1/tokens?search=${encodeURIComponent(tokenSymbol ?? '')}`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          },
        );
        if (!res.ok) throw new Error('Failed to fetch tokens');
        return res.json();
      } catch (error) {
        setError(error as unknown as Error);
        throw error;
      }
    },
  );

  const { trigger: deleteToken, isMutating: isDeletingToken } = useSWRMutation(
    authToken ? [authToken, 'deleteToken'] : null,
    async ([authToken], { arg }: { arg: DeleteTokenInput }) => {
      try {
        return await deleteTokenAction(arg, { authToken });
      } catch (error) {
        setError(error as unknown as Error);
        throw error;
      }
    },
  );

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
          if (decodedRegular.functionName === 'deployToken') {
            actions.push('deployToken');
            return;
          }
        } catch (error) {}

        try {
          const decodedOwnership = decodeFunctionData({
            abi: ownershipTokenFactoryAbi,
            data: tx.data,
          });
          if (decodedOwnership.functionName === 'deployOwnershipToken') {
            actions.push('deployOwnershipToken');
            return;
          }
        } catch (error) {}

        try {
          const decodedDecaying = decodeFunctionData({
            abi: decayingTokenFactoryAbi,
            data: tx.data,
          });
          if (decodedDecaying.functionName === 'deployDecayingToken') {
            actions.push('deployDecayingToken');
            return;
          }
        } catch (error) {}
      });

      return actions;
    } catch (error) {
      console.error('Failed to fetch proposal actions:', error);
      setError(error as unknown as Error);
      return [];
    }
  }, []);

  const isValidProposalAction = (actions: string[]) => {
    const validActions = [
      'deployToken',
      'deployOwnershipToken',
      'deployDecayingToken',
    ];
    return (
      actions.length > 0 &&
      actions.every((action) => validActions.includes(action))
    );
  };

  const vote = useCallback(
    async (proposalId: number, support: boolean) => {
      if (!client) throw new Error('Smart wallet not connected');
      if (!address) throw new Error('Wallet not connected');
      if (proposalId == null) throw new Error('Proposal ID is required');

      setIsVoting(true);
      setError(null);
      try {
        return await client.writeContract({
          address: daoProposalsImplementationConfig.address[8453],
          abi: daoProposalsImplementationConfig.abi,
          functionName: 'vote',
          args: [BigInt(proposalId), support],
        });
      } catch (error) {
        setError(error as unknown as Error);
        throw error;
      } finally {
        setIsVoting(false);
      }
    },
    [address, client],
  );

  const checkProposalExpiration = useCallback(
    async (proposalId: number) => {
      if (!client) throw new Error('Smart wallet not connected');
      if (!address) throw new Error('Wallet not connected');
      if (proposalId == null) throw new Error('Proposal ID is required');

      setIsCheckingExpiration(true);
      setError(null);
      try {
        return await client.writeContract({
          address: daoProposalsImplementationConfig.address[8453],
          abi: daoProposalsImplementationConfig.abi,
          functionName: 'checkProposalExpiration',
          args: [BigInt(proposalId)],
        });
      } catch (error) {
        setError(error as unknown as Error);
        throw error;
      } finally {
        setIsCheckingExpiration(false);
      }
    },
    [address, client],
  );

  useEffect(() => {
    if (!proposalId || !tokenSymbol || !authToken) return;

    const eventSource = new EventSource(
      `/api/v1/proposal-events/proposal-rejected?proposalId=${proposalId}`,
    );

    eventSource.onmessage = async (event) => {
      console.log('SSE event received:', event.data);
      try {
        const data = JSON.parse(event.data);
        if (
          data.event === 'ProposalRejected' &&
          data.proposalId === String(proposalId)
        ) {
          const actions = await fetchProposalActions(Number(proposalId));
          if (!isValidProposalAction(actions)) return;

          const tokens = await fetchTokens();
          const token = tokens?.find((t) => t.symbol === tokenSymbol);
          if (token?.id != null) {
            await deleteToken({ id: BigInt(token.id) });
            console.log(`Token ${tokenSymbol} (ID: ${token.id}) deleted`);
          } else {
            console.error('Token not found');
          }
        }
      } catch (error) {
        console.error('Error handling SSE event:', error);
        setError(error as unknown as Error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      setError(error as unknown as Error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [
    proposalId,
    tokenSymbol,
    authToken,
    fetchProposalActions,
    fetchTokens,
    deleteToken,
  ]);

  const handleAccept = async () => {
    setError(null);
    try {
      if (proposalId != null) {
        await vote(proposalId, true);
      }
    } catch (error) {
      console.error('Failed to vote yes:', error);
      setError(error as unknown as Error);
    }
  };

  const handleReject = async () => {
    setError(null);
    try {
      if (proposalId != null) {
        await vote(proposalId, false);
      }
    } catch (error) {
      console.error('Failed to vote no:', error);
      setError(error as unknown as Error);
    }
  };

  const handleCheckProposalExpiration = async () => {
    setError(null);
    try {
      if (proposalId != null) {
        await checkProposalExpiration(proposalId);
      }
    } catch (error) {
      console.error('Failed to check proposal expiration:', error);
      setError(error as unknown as Error);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return {
    handleAccept,
    handleReject,
    handleCheckProposalExpiration,
    isVoting,
    isCheckingExpiration,
    isDeletingToken,
    error,
    clearError,
  };
};
