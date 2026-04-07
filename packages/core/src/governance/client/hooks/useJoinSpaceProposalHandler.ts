'use client';

import { useCallback } from 'react';
import {
  daoSpaceFactoryImplementationAbi,
  daoProposalsImplementationConfig,
} from '@hypha-platform/core/generated';
import {
  getProposalDetails,
  publicClient,
  getSpaceDetails,
  type Space,
} from '@hypha-platform/core/client';
import useSWRMutation from 'swr/mutation';
import { decodeFunctionData, parseEventLogs } from 'viem';
import { createAgreementAction } from '../../server/actions';
import { CreateAgreementInput, DocumentState } from '../../types';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { useParams } from 'next/navigation';
import { useJwt } from '@hypha-platform/core/client';
import useSWR from 'swr';

interface JoinSpaceTransaction {
  target: string;
  data: `0x${string}`;
  value: bigint;
}

export const useJoinSpaceProposalHandler = ({
  authToken,
}: {
  authToken?: string | null;
}) => {
  const { id: currentSpaceSlug } = useParams();
  const { space: currentSpace } = useSpaceBySlug(currentSpaceSlug as string);
  const spacesEndpoint = '/api/v1/spaces?parentOnly=false';
  const { jwt } = useJwt();
  const {
    data: allSpaces,
    isLoading: isLoadingSpaces,
    error: spacesError,
    mutate: mutateSpaces,
  } = useSWR(
    jwt ? [spacesEndpoint, jwt] : null,
    async ([endpoint, token]) => {
      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error(
          `Failed to fetch spaces: ${res.status} ${res.statusText}`,
        );
      }
      return res.json();
    },
    {
      onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
        if (error.message.includes('404')) return;

        if (retryCount >= 10) return;

        setTimeout(() => revalidate({ retryCount }), 500);
      },
    },
  );
  const { trigger: createAgreement } = useSWRMutation(
    authToken ? [authToken, 'createAgreement'] : null,
    async ([authToken], { arg }: { arg: CreateAgreementInput }) =>
      createAgreementAction(arg, { authToken }),
  );

  const findSpaceByWeb3Id = useCallback(
    (web3SpaceId: number): Space | undefined => {
      return allSpaces?.find(
        (space: Space) => space.web3SpaceId === web3SpaceId,
      );
    },
    [allSpaces],
  );

  const getSpaceJoinMethod = useCallback(
    async (spaceId: number) => {
      try {
        const spaceDetails = await publicClient.readContract(
          getSpaceDetails({ spaceId: BigInt(spaceId) }),
        );

        const [
          unity,
          quorum,
          votingPowerSource,
          tokenAdresses,
          members,
          exitMethod,
          joinMethod,
          createdAt,
          creator,
          executor,
        ] = spaceDetails;

        return joinMethod;
      } catch (error) {
        console.error('Error fetching space join method:', error);
        return null;
      }
    },
    [publicClient, getSpaceDetails],
  );

  const getCreatedProposalIdFromReceipt = useCallback(
    async (txHash: `0x${string}`): Promise<number | null> => {
      try {
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        const logs = parseEventLogs({
          abi: daoProposalsImplementationConfig.abi,
          logs: receipt.logs,
          strict: false,
        });

        const proposalCreatedLog = logs.find(
          (log) => log.eventName === 'ProposalCreated',
        );

        if (proposalCreatedLog && proposalCreatedLog.args.proposalId) {
          return Number(proposalCreatedLog.args.proposalId);
        }

        console.warn('ProposalCreated event not found in transaction receipt');
        return null;
      } catch (error) {
        console.error('Error getting proposalId from receipt:', error);
        return null;
      }
    },
    [],
  );

  const createInviteProposal = useCallback(
    async (
      targetSpaceId: number,
      createdProposalId: number,
      originalProposalId: number,
    ) => {
      try {
        if (!jwt) {
          throw new Error('JWT token is not available');
        }

        const maxAttempts = 10;
        const retryDelay = 500;
        const pollInterval = 200;
        const maxPollTime = 3000;

        const fetchAndFindSpace = async (): Promise<Space | null> => {
          if (!jwt) return null;

          try {
            const res = await fetch(spacesEndpoint, {
              headers: {
                Authorization: `Bearer ${jwt}`,
              },
            });
            if (!res.ok) {
              console.warn(
                `Failed to fetch spaces: ${res.status} ${res.statusText}`,
              );
              return null;
            }
            const spaces: Space[] = await res.json();
            return spaces.find((s) => s.web3SpaceId === targetSpaceId) ?? null;
          } catch (error) {
            console.warn('Error fetching spaces directly:', error);
            return null;
          }
        };

        const waitForSpace = async (): Promise<Space> => {
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
              await mutateSpaces();
            } catch (error) {
              console.warn(
                `Error during mutateSpaces on attempt ${attempt}:`,
                error,
              );
            }
            let targetSpace: Space | undefined = undefined;

            const pollStartTime = Date.now();
            while (Date.now() - pollStartTime < maxPollTime) {
              targetSpace = findSpaceByWeb3Id(targetSpaceId);
              if (targetSpace) {
                console.log(
                  `Space ${targetSpaceId} found in cache on attempt ${attempt}/${maxAttempts}`,
                );
                return targetSpace;
              }

              await new Promise((resolve) => setTimeout(resolve, pollInterval));
            }

            const directlyFetchedSpace = await fetchAndFindSpace();
            if (directlyFetchedSpace) {
              console.log(
                `Space ${targetSpaceId} found via direct fetch on attempt ${attempt}/${maxAttempts}`,
              );
              await mutateSpaces();
              return directlyFetchedSpace;
            }

            const spacesCount = allSpaces?.length ?? 0;
            const web3Ids = allSpaces?.map((s: Space) => s.web3SpaceId) ?? [];
            console.log(
              `Space ${targetSpaceId} not found, attempt ${attempt}/${maxAttempts}. ` +
                `Spaces loaded: ${spacesCount}, Loading: ${isLoadingSpaces}, ` +
                `Error: ${spacesError ? String(spacesError) : 'none'}, ` +
                `Available web3Ids: [${web3Ids.slice(0, 10).join(', ')}${
                  web3Ids.length > 10 ? '...' : ''
                }]`,
            );

            if (attempt < maxAttempts) {
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
            }
          }

          const finalDirectFetch = await fetchAndFindSpace();
          if (finalDirectFetch) {
            await mutateSpaces();
            return finalDirectFetch;
          }

          const finalSpace = findSpaceByWeb3Id(targetSpaceId);
          if (finalSpace) {
            return finalSpace;
          }

          const spacesCount = allSpaces?.length ?? 0;
          const web3Ids = allSpaces?.map((s: Space) => s.web3SpaceId) ?? [];
          throw new Error(
            `Space with web3Id ${targetSpaceId} not found after ${maxAttempts} attempts. ` +
              `Spaces loaded: ${spacesCount}, Loading: ${isLoadingSpaces}, ` +
              `Error: ${spacesError ? String(spacesError) : 'none'}, ` +
              `Available web3Ids: [${web3Ids.slice(0, 20).join(', ')}${
                web3Ids.length > 20 ? '...' : ''
              }]`,
          );
        };

        const targetSpace = await waitForSpace();

        const spaceUrl = `/en/dho/${currentSpace?.slug}/agreements/`;

        const inviteProposalData: CreateAgreementInput = {
          title: 'Invite Space',
          description: `**${currentSpace?.title} has just requested to join as a member!**

        To move forward with onboarding, we'll need our space's approval on this proposal.

        You can review ${currentSpace?.title} <span className="text-accent-9">[here](${spaceUrl}).</span>`,
          slug: `invite-request-${currentSpace?.id}-${Date.now()}`,
          creatorId: currentSpace?.id as number,
          spaceId: targetSpace.id,
          web3ProposalId: createdProposalId,
          label: 'Invite',
          state: DocumentState.PROPOSAL,
        };

        await createAgreement(inviteProposalData);
        console.log(
          `Created invite proposal in DB for space ${targetSpaceId}, web3 proposal ${createdProposalId}`,
        );
      } catch (error) {
        console.error('Error creating invite proposal in DB:', error);
        throw error;
      }
    },
    [
      createAgreement,
      findSpaceByWeb3Id,
      currentSpace?.id,
      isLoadingSpaces,
      allSpaces,
      jwt,
      spacesError,
      mutateSpaces,
    ],
  );

  const handleJoinSpaceExecutedProposal = useCallback(
    async (proposalId: number, txHash?: `0x${string}`) => {
      try {
        console.log('Processing executed proposal with joinSpace:', proposalId);

        const proposalDetails = await publicClient.readContract(
          getProposalDetails({ proposalId: BigInt(proposalId) }),
        );

        const transactions = proposalDetails[9] as JoinSpaceTransaction[];

        for (const tx of transactions) {
          try {
            const decoded = decodeFunctionData({
              abi: daoSpaceFactoryImplementationAbi,
              data: tx.data,
            });

            if (decoded.functionName === 'joinSpace') {
              const targetSpaceId = Number(decoded.args[0]);
              console.log(
                `Found joinSpace transaction for space ${targetSpaceId}`,
              );

              const joinMethod = await getSpaceJoinMethod(targetSpaceId);

              if (joinMethod === 2n) {
                console.log(
                  `Space ${targetSpaceId} has invite-only join method`,
                );

                let createdProposalId: number | null = null;

                if (txHash) {
                  createdProposalId = await getCreatedProposalIdFromReceipt(
                    txHash,
                  );
                }

                if (!createdProposalId) {
                  console.warn(
                    'Could not determine created proposal ID, need alternative approach',
                  );
                  return;
                }

                await createInviteProposal(
                  targetSpaceId,
                  createdProposalId,
                  proposalId,
                );

                console.log(
                  `JoinSpace created proposal ${createdProposalId} in space ${targetSpaceId}`,
                );
              } else {
                console.log(
                  `Space ${targetSpaceId} does not require invite (join method: ${joinMethod})`,
                );
              }
            }
          } catch (error) {
            console.log('Not a joinSpace transaction, skipping:', error);
            continue;
          }
        }
      } catch (error) {
        console.error('Error handling executed proposal:', error);
      }
    },
    [getSpaceJoinMethod, getCreatedProposalIdFromReceipt, createInviteProposal],
  );

  return {
    handleJoinSpaceExecutedProposal,
  };
};
