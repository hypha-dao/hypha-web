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
import { decodeFunctionData, parseEventLogs } from 'viem';
import { deleteTokenAction, updateTokenAction } from '../../server/actions';
import { DeleteTokenInput, UpdateTokenInput } from '../../types';

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

  const { trigger: fetchTokens } = useSWRMutation<DbToken[]>(
    ['findAllTokens', tokenSymbol],
    async () => {
      const res = await fetch(
        `/api/v1/tokens?search=${encodeURIComponent(tokenSymbol ?? '')}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        },
      );
      if (!res.ok) throw new Error('Failed to fetch tokens');
      return res.json();
    },
  );

  const { trigger: deleteToken, isMutating: isDeletingToken } = useSWRMutation(
    authToken ? [authToken, 'deleteToken'] : null,
    async ([authToken], { arg }: { arg: DeleteTokenInput }) =>
      deleteTokenAction(arg, { authToken }),
  );

  const { trigger: updateToken, isMutating: isUpdatingToken } = useSWRMutation(
    authToken ? [authToken, 'updateToken'] : null,
    async ([authToken], { arg }: { arg: UpdateTokenInput }) =>
      updateTokenAction(arg, { authToken }),
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

  const extractTokenAddressFromReceipt = async (txHash: `0x${string}`) => {
    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      const logs = parseEventLogs({
        abi: [
          ...regularTokenFactoryAbi,
          ...ownershipTokenFactoryAbi,
          ...decayingTokenFactoryAbi,
        ],
        logs: receipt.logs,
        strict: false,
      });

      const deployLog = logs.find((log) => log.eventName === 'TokenDeployed');

      if (deployLog) {
        return deployLog.args.tokenAddress as string;
      } else {
        throw new Error('TokenDeployed event not found in logs');
      }
    } catch (error) {
      console.error('Failed to extract token address:', error);
      throw error;
    }
  };

  const vote = useCallback(
    async (proposalId: number, support: boolean) => {
      if (!client) throw new Error('Smart wallet not connected');
      if (!address) throw new Error('Wallet not connected');
      if (proposalId == null) throw new Error('Proposal ID is required');

      setIsVoting(true);
      try {
        return await client.writeContract({
          address: daoProposalsImplementationConfig.address[8453],
          abi: daoProposalsImplementationConfig.abi,
          functionName: 'vote',
          args: [BigInt(proposalId), support],
        });
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
      try {
        return await client.writeContract({
          address: daoProposalsImplementationConfig.address[8453],
          abi: daoProposalsImplementationConfig.abi,
          functionName: 'triggerExecutionCheck',
          args: [BigInt(proposalId)],
        });
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setIsCheckingExpiration(false);
      }
    },
    [address, client],
  );

  useEffect(() => {
    if (!proposalId || !tokenSymbol || !authToken) return;

    const rejectedEventSource = new EventSource(
      `/api/v1/proposal-events/proposal-rejected?proposalId=${proposalId}`,
    );

    rejectedEventSource.onmessage = async (event) => {
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
        console.error('Error handling SSE event (rejected):', error);
      }
    };

    rejectedEventSource.onerror = (error) => {
      console.error('EventSource error (rejected):', error);
      rejectedEventSource.close();
    };

    const executedEventSource = new EventSource(
      `/api/v1/proposal-events/proposal-executed?proposalId=${proposalId}`,
    );

    executedEventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (
          data.event === 'ProposalExecuted' &&
          data.proposalId === String(proposalId)
        ) {
          const actions = await fetchProposalActions(Number(proposalId));
          if (!isValidProposalAction(actions)) return;

          if (!data.txHash) {
            throw new Error('txHash not found in event data');
          }
          const tokenAddress = await extractTokenAddressFromReceipt(
            data.txHash as `0x${string}`,
          );

          await updateToken({
            agreementWeb3Id: Number(proposalId),
            address: tokenAddress,
          });
        }
      } catch (error) {
        console.error('Error handling SSE event (executed):', error);
      }
    };

    executedEventSource.onerror = (error) => {
      console.error('EventSource error (executed):', error);
      executedEventSource.close();
    };

    return () => {
      rejectedEventSource.close();
      executedEventSource.close();
    };
  }, [
    proposalId,
    tokenSymbol,
    authToken,
    fetchProposalActions,
    fetchTokens,
    deleteToken,
    updateToken,
  ]);

  const handleAccept = () => {
    if (proposalId == null) throw new Error('Proposal ID is missing');
    return vote(proposalId, true);
  };

  const handleReject = () => {
    if (proposalId == null) throw new Error('Proposal ID is missing');
    return vote(proposalId, false);
  };

  const handleCheckProposalExpiration = () => {
    if (proposalId == null) throw new Error('Proposal ID is missing');
    return checkProposalExpiration(proposalId);
  };

  return {
    handleAccept,
    handleReject,
    handleCheckProposalExpiration,
    isVoting,
    isCheckingExpiration,
    isDeletingToken,
    isUpdatingToken,
  };
};
