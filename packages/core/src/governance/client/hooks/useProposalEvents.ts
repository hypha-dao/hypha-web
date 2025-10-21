'use client';

import { useEffect } from 'react';
import { daoProposalsImplementationConfig } from '@hypha-platform/core/generated';
import { publicClient } from '@hypha-platform/core/client';
import { useProposalActions } from './useProposalActions';
import { useTokenManagement } from './useTokenManagement';
import { useTokenDeploymentWatcher } from './useTokenDeploymentWatcher';
import { extractTokenAddressFromReceipt } from './extractTokenAddressFromReceipt';

export const useProposalEvents = ({
  proposalId,
  tokenSymbol,
  authToken,
  onProposalExecuted,
  onProposalRejected,
}: {
  proposalId?: number | null;
  tokenSymbol?: string | null;
  authToken?: string | null;
  onProposalExecuted?: (transactionHash: string) => void;
  onProposalRejected?: () => void;
}) => {
  const {
    fetchTokens,
    deleteToken,
    updateToken,
    isDeletingToken,
    isUpdatingToken,
  } = useTokenManagement({ tokenSymbol, authToken });
  const { setupTokenDeployedWatcher } = useTokenDeploymentWatcher({
    proposalId: proposalId ?? 0,
    updateToken,
  });
  const { fetchProposalActions, isValidProposalAction } = useProposalActions();

  useEffect(() => {
    if (!proposalId || !authToken) {
      return;
    }

    const handleProposalExecuted = async (transactionHash: string) => {
      try {
        const actions = await fetchProposalActions(Number(proposalId));

        if (!isValidProposalAction(actions)) {
          return;
        }

        setupTokenDeployedWatcher(transactionHash as `0x${string}`);

        try {
          const tokenAddress = await extractTokenAddressFromReceipt(
            transactionHash as `0x${string}`,
          );

          await updateToken({
            agreementWeb3Id: Number(proposalId),
            address: tokenAddress,
          });
        } catch (receiptError) {
          console.log('Error extracting token address:', receiptError);
        }

        onProposalExecuted?.(transactionHash);
      } catch (error) {
        console.error('Error handling proposal execution:', error);
      }
    };

    const handleProposalRejected = async () => {
      try {
        const actions = await fetchProposalActions(Number(proposalId));

        if (!isValidProposalAction(actions)) {
          return;
        }

        const tokens = await fetchTokens();
        const token = tokens?.find((t) => t.symbol === tokenSymbol);

        if (token?.id != null) {
          await deleteToken({ id: BigInt(token.id) });
          onProposalRejected?.();
        } else {
          console.error('Token not found for deletion:', {
            tokenSymbol,
            tokens,
          });
        }
      } catch (error) {
        console.error('Error handling proposal rejection:', error);
      }
    };

    const unwatchExecuted = publicClient.watchContractEvent({
      address: daoProposalsImplementationConfig.address[8453],
      abi: daoProposalsImplementationConfig.abi,
      eventName: 'ProposalExecuted',
      onLogs: async (logs) => {
        for (const log of logs) {
          try {
            const eventProposalId = log.args.proposalId;

            if (eventProposalId === BigInt(proposalId)) {
              await handleProposalExecuted(log.transactionHash);
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
              await handleProposalRejected();
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
      console.log('Cleaning up event listeners for proposal:', proposalId);
      unwatchExecuted();
      unwatchRejected();
    };
  }, [
    proposalId,
    tokenSymbol,
    authToken,
    fetchProposalActions,
    isValidProposalAction,
    fetchTokens,
    deleteToken,
    updateToken,
    setupTokenDeployedWatcher,
    onProposalExecuted,
    onProposalRejected,
  ]);

  return {
    isDeletingToken,
    isUpdatingToken,
  };
};
