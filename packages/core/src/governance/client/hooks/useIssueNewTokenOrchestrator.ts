'use client';

import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
import { useCallback, useMemo } from 'react';
import { z } from 'zod';

import { useOrchestratorTasks } from './useOrchestratorTasks';
import { useIssueTokenMutationsWeb3Rpc } from './useIssueNewTokenMutations.web3.rsc';
import {
  schemaCreateAgreementWeb2,
  schemaCreateAgreementFiles,
} from '../../validation';
import { Config } from '@wagmi/core';

type CreateIssueTokenArg = z.infer<typeof schemaCreateAgreementWeb2> & {
  web3SpaceId: number;
  name: string;
  symbol: string;
  maxSupply: number;
  transferable: boolean;
  isVotingToken: boolean;
  type: 'voice' | 'ownership' | 'utility' | 'credits';
};

export const useCreateIssueTokenOrchestrator = ({
  authToken,
  config,
}: {
  authToken?: string | null;
  config?: Config;
}) => {
  const web3 = useIssueTokenMutationsWeb3Rpc(config);
  const {
    web2,
    taskState,
    startTask,
    completeTask,
    errorTask,
    resetTasks,
    agreementFiles,
    currentAction,
    progress,
  } = useOrchestratorTasks({ authToken });

  const { trigger: createIssueToken } = useSWRMutation(
    'createIssueTokenOrchestration',
    async (_: string, { arg }: { arg: CreateIssueTokenArg }) => {
      startTask('CREATE_WEB2_AGREEMENT');
      const inputWeb2 = schemaCreateAgreementWeb2.parse(arg);
      const createdAgreement = await web2.createAgreement(inputWeb2);
      completeTask('CREATE_WEB2_AGREEMENT');

      const web2Slug = createdAgreement?.slug;

      try {
        if (config) {
          startTask('CREATE_WEB3_AGREEMENT');
          await web3.createIssueToken({
            spaceId: arg.web3SpaceId,
            name: arg.name,
            symbol: arg.symbol,
            maxSupply: arg.maxSupply,
            transferable: arg.transferable,
            isVotingToken: arg.isVotingToken,
            type: arg.type,
          });
          completeTask('CREATE_WEB3_AGREEMENT');
        }
      } catch (err) {
        if (web2Slug) {
          await web2.deleteAgreementBySlug({ slug: web2Slug });
        }
        throw err;
      }

      startTask('UPLOAD_FILES');
      const files = schemaCreateAgreementFiles.parse(arg);
      await agreementFiles.upload(files);
      completeTask('UPLOAD_FILES');
    },
  );

  const { data: updatedWeb2Agreement } = useSWR(
    web2.createdAgreement?.slug && agreementFiles.files
      ? [
          web2.createdAgreement.slug,
          agreementFiles.files,
          web3.createdToken?.proposalId,
          'linkingWeb2AndWeb3Token',
        ]
      : null,
    async ([slug, uploadedFiles, web3ProposalId]) => {
      try {
        startTask('LINK_WEB2_AND_WEB3_AGREEMENT');
        const result = await web2.updateAgreementBySlug({
          slug,
          web3ProposalId: web3ProposalId ? Number(web3ProposalId) : undefined,
          attachments: uploadedFiles.attachments
            ? Array.isArray(uploadedFiles.attachments)
              ? uploadedFiles.attachments
              : [uploadedFiles.attachments]
            : [],
          leadImage: uploadedFiles.leadImage,
        });
        completeTask('LINK_WEB2_AND_WEB3_AGREEMENT');
        return result;
      } catch (error) {
        if (error instanceof Error) {
          errorTask('LINK_WEB2_AND_WEB3_AGREEMENT', error.message);
        }
        throw error;
      }
    },
  );

  const errors = useMemo(
    () =>
      [
        web2.errorCreateAgreementMutation,
        web3.errorCreateToken,
        web3.errorWaitTokenFromTx,
      ].filter(Boolean),
    [web2, web3],
  );

  const reset = useCallback(() => {
    resetTasks();
    web2.resetCreateAgreementMutation();
    web3.resetCreateIssueToken();
  }, [resetTasks, web2, web3]);

  return {
    reset,
    createIssueToken,
    agreement: {
      ...updatedWeb2Agreement,
      ...web3.createdToken,
    },
    taskState,
    currentAction,
    progress,
    isPending: progress > 0 && progress < 100,
    isError: errors.length > 0,
    errors,
  };
};
