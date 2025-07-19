'use client';
import useSWR from 'swr';
import { z } from 'zod';
import React, { useState } from 'react';
import useSWRMutation from 'swr/mutation';
import { Config } from 'wagmi';
import { useAgreementMutationsWeb2Rsc } from './useAgreementMutations.web2.rsc';
import {
  schemaRequestInvite,
  schemaCreateAgreementWeb2,
} from '../../validation';
import { useAddMemberMutationsWeb3Rpc } from './useAddMemberMutations.web3.rpc';

type UseAddMemberOrchestratorInput = {
  authToken?: string | null;
  config?: Config;
  spaceId?: number;
  memberAddress?: `0x${string}`;
};

export const useAddMemberOrchestrator = ({
  authToken,
  config,
  spaceId,
  memberAddress,
}: UseAddMemberOrchestratorInput) => {
  const web2 = useAgreementMutationsWeb2Rsc(authToken);
  const [isCreating, setIsCreating] = useState(false);

  const web3 = useAddMemberMutationsWeb3Rpc({
    spaceId: spaceId ?? undefined,
    memberAddress: memberAddress ?? undefined,
  });

  const { trigger: requestInvite } = useSWRMutation(
    'requestInviteOrchestration',
    async (_, { arg }: { arg: z.infer<typeof schemaRequestInvite> }) => {
      setIsCreating(true);
      try {
        const inputCreateAgreementWeb2 = schemaCreateAgreementWeb2.parse({
          title: arg.title,
          description: arg.description,
          slug: arg.slug || `invite-request-${arg.spaceId}-${Date.now()}`,
          creatorId: arg.creatorId,
          spaceId: arg.spaceId,
          web3ProposalId: arg.web3ProposalId,
          label: arg.label,
        });
        const createdAgreement = await web2.createAgreement(
          inputCreateAgreementWeb2,
        );

        const { memberAddress } = arg;

        if (config && spaceId) {
          if (!memberAddress) {
            throw new Error('memberAddress is required');
          }
          await web3.addMember();
        } else if (config && !spaceId) {
          throw new Error('spaceId is required for Web3 operations');
        }

        return createdAgreement;
      } catch (err) {
        const web2Slug = web2.createdAgreement?.slug;
        if (web2Slug) {
          await web2.deleteAgreementBySlug({ slug: web2Slug });
        }
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
  );

  const { data: updatedWeb2Agreement } = useSWR(
    web2.createdAgreement?.slug &&
      (!config || web3.createdProposal?.proposalId !== undefined)
      ? [
          web2.createdAgreement.slug,
          web3.createdProposal?.proposalId,
          'linkWeb2AndWeb3',
        ]
      : null,
    async ([slug, proposalId]) => {
      return web2.updateAgreementBySlug({
        slug,
        web3ProposalId: proposalId ? Number(proposalId) : undefined,
      });
    },
    {
      revalidateOnMount: true,
      shouldRetryOnError: false,
    },
  );

  const errors = React.useMemo(
    () =>
      [
        web2.errorCreateAgreementMutation,
        web3.errorAddMember,
        web3.errorWaitForReceipt,
      ].filter(Boolean),
    [
      web2.errorCreateAgreementMutation,
      web3.errorAddMember,
      web3.errorWaitForReceipt,
    ],
  );

  return {
    requestInvite,
    agreement: {
      ...web2.createdAgreement,
      ...web3.createdProposal,
      ...updatedWeb2Agreement,
    },
    isCreating,
    isError: errors.length > 0,
    errors,
  };
};
