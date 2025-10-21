'use client';

import { useEffect } from 'react';
import { daoProposalsImplementationConfig } from '@hypha-platform/core/generated';
import {
  publicClient,
  useJoinSpaceProposalHandler,
} from '@hypha-platform/core/client';
import { useProposalVoting } from './useProposalVoting';
import { useTokenManagement } from './useTokenManagement';
import { useTokenDeploymentWatcher } from './useTokenDeploymentWatcher';
import { useProposalActions } from './useProposalActions';
import { extractTokenAddressFromReceipt } from './extractTokenAddressFromReceipt';

export const useVote = ({
  proposalId,
  tokenSymbol,
  authToken,
}: {
  proposalId?: number | null;
  tokenSymbol?: string | null;
  authToken?: string | null;
}) => {
  const voting = useProposalVoting({ proposalId });
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
  const { handleJoinSpaceExecutedProposal } = useJoinSpaceProposalHandler({
    authToken,
  });

  useEffect(() => {
    if (!proposalId || !authToken) {
      return;
    }

    const unwatchExecuted = publicClient.watchContractEvent({
      address: daoProposalsImplementationConfig.address[8453],
      abi: daoProposalsImplementationConfig.abi,
      eventName: 'ProposalExecuted',
      onLogs: async (logs) => {
        for (const log of logs) {
          try {
            const eventProposalId = log.args.proposalId;

            if (eventProposalId === BigInt(proposalId)) {
              await handleJoinSpaceExecutedProposal(
                Number(proposalId),
                log.transactionHash,
              );
              const actions = await fetchProposalActions(Number(proposalId));

              if (!isValidProposalAction(actions)) {
                return;
              }

              setupTokenDeployedWatcher(log.transactionHash);

              try {
                const tokenAddress = await extractTokenAddressFromReceipt(
                  log.transactionHash,
                );

                await updateToken({
                  agreementWeb3Id: Number(proposalId),
                  address: tokenAddress,
                });
              } catch (receiptError) {
                console.log(receiptError);
              }
            } else {
              console.log(
                'Proposal ID mismatch:',
                eventProposalId?.toString(),
                '!=',
                proposalId,
              );
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
        console.log('ProposalRejected logs received:', logs.length);

        for (const log of logs) {
          try {
            const eventProposalId = log.args.proposalId;

            if (eventProposalId === BigInt(proposalId)) {
              const actions = await fetchProposalActions(Number(proposalId));

              if (!isValidProposalAction(actions)) {
                return;
              }

              const tokens = await fetchTokens();

              const token = tokens?.find((t) => t.symbol === tokenSymbol);

              if (token?.id != null) {
                await deleteToken({ id: BigInt(token.id) });
              } else {
                console.error('Token not found for deletion:', {
                  tokenSymbol,
                  tokens,
                });
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
    handleJoinSpaceExecutedProposal,
    setupTokenDeployedWatcher,
  ]);

  return {
    ...voting,
    isDeletingToken,
    isUpdatingToken,
  };
};
