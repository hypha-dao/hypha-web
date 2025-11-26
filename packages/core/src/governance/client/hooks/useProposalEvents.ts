'use client';

import { useEffect, useState } from 'react';
import {
  daoProposalsImplementationConfig,
  daoSpaceFactoryImplementationConfig,
} from '@hypha-platform/core/generated';
import {
  publicClient,
  useCreateEvent,
  useSpacesByWeb3Ids,
} from '@hypha-platform/core/client';
import { useProposalActions } from './useProposalActions';
import { useTokenManagement } from './useTokenManagement';
import { useTokenDeploymentWatcher } from './useTokenDeploymentWatcher';
import { extractTokenAddressFromReceipt } from './extractTokenAddressFromReceipt';

export interface OnProposalCreatedInput {
  creator: `0x${string}`;
  web3ProposalId: bigint;
  web3SpaceId: bigint;
}

export const useProposalEvents = ({
  documentId,
  proposalId,
  tokenSymbol,
  authToken,
  onProposalExecuted,
  onProposalRejected,
  onProposalCreated,
}: {
  documentId?: number | null;
  proposalId?: number | null;
  tokenSymbol?: string | null;
  authToken?: string | null;
  onProposalExecuted?: (transactionHash: string) => Promise<void>;
  onProposalRejected?: () => Promise<void>;
  onProposalCreated?: (params: OnProposalCreatedInput) => Promise<void>;
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
  const { createEvent } = useCreateEvent({ authToken });
  const [joinState, setJoinState] = useState<{
    web3spaceIds: bigint[];
    memberAddress?: `0x${string}`;
  }>({ web3spaceIds: [] });
  const { spaces } = useSpacesByWeb3Ids(joinState.web3spaceIds, false);

  useEffect(() => {
    if (!authToken) {
      return;
    }

    const handleProposalExecuted = async (transactionHash: string) => {
      try {
        const actions = await fetchProposalActions(Number(proposalId));

        if (!isValidProposalAction(actions)) {
          await onProposalExecuted?.(transactionHash);
          return;
        }

        setupTokenDeployedWatcher(transactionHash as `0x${string}`);

        try {
          const tokenAddress = await extractTokenAddressFromReceipt(
            transactionHash as `0x${string}`,
          );

          if (tokenAddress) {
            await updateToken({
              agreementWeb3Id: Number(proposalId),
              address: tokenAddress,
            });
          }
        } catch (receiptError) {
          console.log('Error extracting token address:', receiptError);
        }

        await onProposalExecuted?.(transactionHash);
      } catch (error) {
        console.error('Error handling proposal execution:', error);
      }
    };

    const handleProposalRejected = async () => {
      try {
        const actions = await fetchProposalActions(Number(proposalId));

        if (!isValidProposalAction(actions)) {
          await onProposalRejected?.();
          return;
        }

        const tokens = await fetchTokens();
        const token = tokens?.find((t) => t.symbol === tokenSymbol);

        if (token?.id != null) {
          await deleteToken({ id: BigInt(token.id) });
          await onProposalRejected?.();
        } else {
          console.error('Token not found for deletion');
          await onProposalRejected?.();
        }
      } catch (error) {
        console.error('Error handling proposal rejection:', error);
        await onProposalRejected?.();
      }
    };

    const handleProposalCreated = async ({
      creator,
      web3ProposalId,
      web3SpaceId,
    }: OnProposalCreatedInput) => {
      try {
        await onProposalCreated?.({
          creator,
          web3ProposalId,
          web3SpaceId,
        });
      } catch (error) {
        console.error('Error handling proposal creation:', error);
      }
    };

    const unwatchExecuted = publicClient.watchContractEvent({
      address: daoProposalsImplementationConfig.address[8453],
      abi: daoProposalsImplementationConfig.abi,
      eventName: 'ProposalExecuted',
      onLogs: async (logs) => {
        if (!documentId || !proposalId) {
          return;
        }
        for (const log of logs) {
          try {
            const eventProposalId = log.args.proposalId;
            if (eventProposalId === BigInt(proposalId)) {
              await handleProposalExecuted(log.transactionHash);
              await createEvent({
                type: 'executeProposal',
                referenceEntity: 'document',
                referenceId: documentId,
                parameters: {},
              });
            }
          } catch (error) {
            console.error('Error handling ProposalExecuted event:', error);
          }
        }
      },
    });

    const unwatchRejected = publicClient.watchContractEvent({
      address: daoProposalsImplementationConfig.address[8453],
      abi: daoProposalsImplementationConfig.abi,
      eventName: 'ProposalRejected',
      onLogs: async (logs) => {
        if (!documentId || !proposalId) {
          return;
        }
        for (const log of logs) {
          try {
            const eventProposalId = log.args.proposalId;
            if (eventProposalId === BigInt(proposalId)) {
              await handleProposalRejected();
              await createEvent({
                type: 'rejectProposal',
                referenceEntity: 'document',
                referenceId: documentId,
                parameters: {},
              });
            }
          } catch (error) {
            console.error('Error handling ProposalRejected event:', error);
          }
        }
      },
    });

    const unwatchExpired = publicClient.watchContractEvent({
      address: daoProposalsImplementationConfig.address[8453],
      abi: daoProposalsImplementationConfig.abi,
      eventName: 'ProposalExpired',
      onLogs: async (logs) => {
        if (!documentId || !proposalId) {
          return;
        }
        for (const log of logs) {
          try {
            const eventProposalId = log.args.proposalId;
            if (eventProposalId === BigInt(proposalId)) {
              await handleProposalRejected();
              await createEvent({
                type: 'rejectProposal',
                referenceEntity: 'document',
                referenceId: documentId,
                parameters: {},
              });
            }
          } catch (error) {
            console.error('Error handling ProposalExpired event:', error);
          }
        }
      },
    });

    const unwatchMemberJoined = publicClient.watchContractEvent({
      address: daoSpaceFactoryImplementationConfig.address[8453],
      abi: daoSpaceFactoryImplementationConfig.abi,
      eventName: 'MemberJoined',
      onLogs: async (logs) => {
        for (const log of logs) {
          try {
            const web3SpaceId = log.args.spaceId;
            const memberAddress = log.args.memberAddress;
            if (web3SpaceId && memberAddress) {
              setJoinState({ web3spaceIds: [web3SpaceId], memberAddress });
            }
          } catch (error) {
            console.error('Error handling MemberJoined event:', error);
          }
        }
      },
    });

    const unwatchProposalCreated = publicClient.watchContractEvent({
      address: daoProposalsImplementationConfig.address[8453],
      abi: daoProposalsImplementationConfig.abi,
      eventName: 'ProposalCreated',
      onLogs: async (logs) => {
        for (const log of logs) {
          try {
            const {
              creator,
              proposalId: web3ProposalId,
              spaceId: web3SpaceId,
            } = log.args;
            if (creator && web3ProposalId && web3SpaceId) {
              await handleProposalCreated({
                creator,
                web3ProposalId,
                web3SpaceId,
              });
            }
          } catch (error) {
            console.error('Error handling ProposalCreated event:', error);
          }
        }
      },
    });

    return () => {
      unwatchExecuted();
      unwatchRejected();
      unwatchExpired();
      unwatchMemberJoined();
      unwatchProposalCreated();
    };
  }, [
    documentId,
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
    onProposalCreated,
  ]);

  useEffect(() => {
    if (
      joinState.web3spaceIds.length > 0 &&
      joinState.memberAddress &&
      spaces?.length > 0
    ) {
      const createJoinSpaceEvent = async ({
        spaceId,
        memberAddress,
      }: {
        spaceId: number;
        memberAddress: string;
      }) => {
        await createEvent({
          type: 'joinSpace',
          referenceEntity: 'space',
          referenceId: spaceId,
          parameters: { memberAddress },
        });
        setJoinState({ web3spaceIds: [] });
      };
      const [space] = spaces;
      if (space?.id) {
        createJoinSpaceEvent({
          spaceId: space.id,
          memberAddress: joinState.memberAddress,
        });
      }
    }
  }, [joinState, spaces]);

  return {
    isDeletingToken,
    isUpdatingToken,
  };
};
