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

  useEffect(() => {
    if (!proposalId || !tokenSymbol || !authToken) return;

    const unwatchExecuted = publicClient.watchContractEvent({
      address: daoProposalsImplementationConfig.address[8453],
      abi: daoProposalsImplementationConfig.abi,
      eventName: 'ProposalExecuted',
      onLogs: async (logs) => {
        for (const log of logs) {
          try {
            const eventProposalId = log.args.proposalId;

            if (eventProposalId === BigInt(proposalId)) {
              console.log('ProposalExecuted event received:', proposalId);

              const actions = await fetchProposalActions(Number(proposalId));
              if (!isValidProposalAction(actions)) return;

              const tokenAddress = await extractTokenAddressFromReceipt(
                log.transactionHash,
              );

              await updateToken({
                agreementWeb3Id: Number(proposalId),
                address: tokenAddress,
              });

              console.log('Token updated after execution');
            }
          } catch (error) {
            console.error('Error handling ProposalExecuted event:', error);
          }
        }
      },
      onError: (error) => {
        console.error('Error watching ProposalExecuted events:', error);
      },
    });

    const unwatchRejected = publicClient.watchContractEvent({
      address: daoProposalsImplementationConfig.address[8453],
      abi: daoProposalsImplementationConfig.abi,
      eventName: 'ProposalRejected',
      onLogs: async (logs) => {
        for (const log of logs) {
          try {
            const eventProposalId = log.args.proposalId;

            if (eventProposalId === BigInt(proposalId)) {
              console.log('ProposalRejected event received:', proposalId);

              const actions = await fetchProposalActions(Number(proposalId));
              if (!isValidProposalAction(actions)) return;

              const tokens = await fetchTokens();
              const token = tokens?.find((t) => t.symbol === tokenSymbol);

              if (token?.id != null) {
                await deleteToken({ id: BigInt(token.id) });
                console.log(
                  `Token ${tokenSymbol} (ID: ${token.id}) deleted after rejection`,
                );
              } else {
                console.error('Token not found for deletion');
              }
            }
          } catch (error) {
            console.error('Error handling ProposalRejected event:', error);
          }
        }
      },
      onError: (error) => {
        console.error('Error watching ProposalRejected events:', error);
      },
    });
    return () => {
      unwatchExecuted();
      unwatchRejected();
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
