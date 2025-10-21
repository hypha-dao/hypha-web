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
  console.log('useVote initialized:', {
    proposalId,
    tokenSymbol,
    authToken: !!authToken,
  });

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
      console.log('useVote: Missing required params', {
        proposalId,
        hasAuthToken: !!authToken,
      });
      return;
    }

    console.log(
      'useVote: Setting up event listeners for proposal:',
      proposalId,
    );

    const unwatchExecuted = publicClient.watchContractEvent({
      address: daoProposalsImplementationConfig.address[8453],
      abi: daoProposalsImplementationConfig.abi,
      eventName: 'ProposalExecuted',
      onLogs: async (logs) => {
        console.log(
          'ProposalExecuted logs received:',
          logs.length,
          'for proposal:',
          proposalId,
        );

        for (const log of logs) {
          try {
            const eventProposalId = log.args.proposalId;
            console.log(
              'Processing log for proposal:',
              eventProposalId?.toString(),
              'target:',
              proposalId,
            );

            if (eventProposalId === BigInt(proposalId)) {
              console.log(
                '✅ ProposalExecuted event matched:',
                proposalId,
                'tx:',
                log.transactionHash,
              );

              console.log('Step 1: Handling join space executed proposal...');
              await handleJoinSpaceExecutedProposal(
                Number(proposalId),
                log.transactionHash,
              );

              console.log('Step 2: Fetching proposal actions...');
              const actions = await fetchProposalActions(Number(proposalId));
              console.log('Proposal actions:', actions);

              if (!isValidProposalAction(actions)) {
                console.log(
                  '❌ Invalid proposal actions, skipping token update',
                );
                return;
              }

              console.log('Step 3: Setting up token deployed watcher...');
              setupTokenDeployedWatcher(log.transactionHash);

              console.log(
                'Step 4: Attempting to extract token address from receipt...',
              );
              try {
                const tokenAddress = await extractTokenAddressFromReceipt(
                  log.transactionHash,
                );
                console.log(
                  '✅ Token address extracted from receipt:',
                  tokenAddress,
                );

                await updateToken({
                  agreementWeb3Id: Number(proposalId),
                  address: tokenAddress,
                });
                console.log('✅ Token updated after execution via receipt');
              } catch (receiptError) {
                console.log(
                  'ℹ️ Token address not found in receipt, waiting for TokenDeployed event...',
                  receiptError,
                );
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
            console.error('❌ Error handling ProposalExecuted event:', error);
          }
        }
      },
      onError: (error) => {
        console.error('❌ Error watching ProposalExecuted events:', error);
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
              console.log('✅ ProposalRejected event matched:', proposalId);

              const actions = await fetchProposalActions(Number(proposalId));
              console.log('Rejection - proposal actions:', actions);

              if (!isValidProposalAction(actions)) {
                console.log(
                  '❌ Invalid proposal actions, skipping token deletion',
                );
                return;
              }

              console.log('Fetching tokens for deletion...');
              const tokens = await fetchTokens();
              console.log('Available tokens:', tokens);

              const token = tokens?.find((t) => t.symbol === tokenSymbol);
              console.log('Token to delete:', token);

              if (token?.id != null) {
                console.log('Deleting token:', tokenSymbol, 'ID:', token.id);
                await deleteToken({ id: BigInt(token.id) });
                console.log(
                  `✅ Token ${tokenSymbol} (ID: ${token.id}) deleted after rejection`,
                );
              } else {
                console.error('❌ Token not found for deletion:', {
                  tokenSymbol,
                  tokens,
                });
              }
            }
          } catch (error) {
            console.error('❌ Error handling ProposalRejected event:', error);
          }
        }
      },
      onError: (error) => {
        console.error('❌ Error watching ProposalRejected events:', error);
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
