'use client';

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { Config } from '@wagmi/core';
import { z } from 'zod';

import {
  schemaCreateAgreement,
  schemaCreateAgreementWeb2,
  schemaCreateAgreementFiles,
} from '../../validation';

import { useDeployFundsMutationsWeb3Rpc } from './useDeployFundsMutations.web3.rpc';
import { useOrchestratorTasks } from './useOrchestratorTasks';

type CreateDeployFundsArg = z.infer<typeof schemaCreateAgreement> & {
  payouts: { amount: string; token: string }[];
  recipient: string;
  web3SpaceId?: number;
};

export const useCreateDeployFundsOrchestrator = ({
  authToken,
  config,
}: {
  authToken?: string | null;
  config?: Config;
}) => {
  const web3 = useDeployFundsMutationsWeb3Rpc(config);
  const {
    taskState,
    currentAction,
    agreementFiles,
    web2,
    progress,
    startTask,
    completeTask,
    errorTask,
    resetTasks,
  } = useOrchestratorTasks({ authToken });

  const { trigger: createDeployFunds } = useSWRMutation(
    'createDeployFundsOrchestration',
    async (_: string, { arg }: { arg: CreateDeployFundsArg }) => {
      startTask('CREATE_WEB2_AGREEMENT');
      const inputWeb2 = schemaCreateAgreementWeb2.parse(arg);
      const createAgreement = await web2.createAgreement(inputWeb2);
      completeTask('CREATE_WEB2_AGREEMENT');

      const web2Slug = createAgreement?.slug ?? web2.createdAgreement?.slug;
      const web3SpaceId = arg.web3SpaceId;

      try {
        if (config && typeof web3SpaceId === 'number') {
          startTask('CREATE_WEB3_AGREEMENT');
          await web3.createDeployFunds({
            spaceId: web3SpaceId,
            payouts: arg.payouts,
            recipient: arg.recipient,
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
      const inputFiles = schemaCreateAgreementFiles.parse(arg);
      await agreementFiles.upload(inputFiles);
      completeTask('UPLOAD_FILES');
    },
  );

  const { data: updatedWeb2Agreement } = useSWR(
    web2.createdAgreement?.slug && agreementFiles.files
      ? [
          web2.createdAgreement.slug,
          agreementFiles.files,
          web3.createdDeployFunds?.proposalId,
          'linkingWeb2AndWeb3',
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
        web3.errorCreateDeployFunds,
        web3.errorWaitDeployFundsFromTransaction,
      ].filter(Boolean),
    [web2, web3],
  );

  const reset = useCallback(() => {
    resetTasks();
    web2.resetCreateAgreementMutation();
    web3.resetCreateDeployFundsMutation();
  }, [resetTasks, web2, web3]);
  return {
    reset,
    createDeployFunds,
    agreement: {
      ...updatedWeb2Agreement,
      ...web3.createdDeployFunds,
    },
    taskState,
    currentAction,
    progress,
    isPending: progress > 0 && progress < 100,
    isError: errors.length > 0,
    errors,
  };
};
