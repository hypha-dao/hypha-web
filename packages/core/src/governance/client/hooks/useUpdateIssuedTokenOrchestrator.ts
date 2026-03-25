'use client';

import useSWRMutation from 'swr/mutation';
import { useCallback, useMemo, useReducer, useState, useRef } from 'react';
import { z } from 'zod';
import { produce } from 'immer';

import { useAgreementFileUploads } from './useAgreementFileUploads';
import { useTokenFileUploads } from './useTokenFileUploads';
import { useAgreementMutationsWeb2Rsc } from './useAgreementMutations.web2.rsc';
import {
  schemaCreateAgreementWeb2,
  schemaCreateAgreementFiles,
} from '../../validation';
import { useTokenMutationsWeb2Rsc } from './useTokenMutationWeb2.rsc';
import { Config } from '@wagmi/core';
import { ReferenceCurrency } from '../../types';
import { getPriceCurrencyFeed, TokenType } from '../../../common';
import {
  UpdateIssuedTokenInput,
  useUpdateIssuedTokenMutationsWeb3Rpc,
} from './useUpdateIssuedTokenMutations.web3.rpc';
import useSWR from 'swr';
import { TokenUpdateData } from '../../types';

type TaskName =
  | 'CREATE_WEB2_AGREEMENT'
  | 'CREATE_WEB3_AGREEMENT'
  | 'UPLOAD_FILES'
  | 'UPLOAD_TOKEN_ICON'
  | 'UPDATE_TOKEN'
  | 'LINK_WEB2_AND_WEB3_AGREEMENT';

type TaskState = {
  [K in TaskName]: {
    status: TaskStatus;
    message?: string;
  };
};

enum TaskStatus {
  IDLE = 'idle',
  IS_PENDING = 'isPending',
  IS_DONE = 'isDone',
  ERROR = 'error',
}

const taskActionDescriptions: Record<TaskName, string> = {
  CREATE_WEB2_AGREEMENT: 'Creating Web2 Agreement...',
  CREATE_WEB3_AGREEMENT: 'Creating Web3 Agreement...',
  UPLOAD_FILES: 'Uploading files...',
  UPLOAD_TOKEN_ICON: 'Uploading token icon...',
  UPDATE_TOKEN: 'Updating token...',
  LINK_WEB2_AND_WEB3_AGREEMENT: 'Linking Web2 and Web3 agreements...',
};

const initialTaskState: TaskState = {
  CREATE_WEB2_AGREEMENT: { status: TaskStatus.IDLE },
  CREATE_WEB3_AGREEMENT: { status: TaskStatus.IDLE },
  UPLOAD_FILES: { status: TaskStatus.IDLE },
  UPLOAD_TOKEN_ICON: { status: TaskStatus.IDLE },
  UPDATE_TOKEN: { status: TaskStatus.IDLE },
  LINK_WEB2_AND_WEB3_AGREEMENT: { status: TaskStatus.IDLE },
};

type ProgressAction =
  | { type: 'START_TASK'; taskName: TaskName; message?: string }
  | { type: 'COMPLETE_TASK'; taskName: TaskName; message?: string }
  | { type: 'SET_ERROR'; taskName: TaskName; message: string }
  | { type: 'RESET' };

const progressStateReducer = (
  state: TaskState,
  action: ProgressAction,
): TaskState =>
  produce(state, (draft) => {
    switch (action.type) {
      case 'START_TASK':
        draft[action.taskName].status = TaskStatus.IS_PENDING;
        draft[action.taskName].message = action.message;
        break;
      case 'COMPLETE_TASK':
        draft[action.taskName].status = TaskStatus.IS_DONE;
        draft[action.taskName].message = action.message;
        break;
      case 'SET_ERROR':
        draft[action.taskName].status = TaskStatus.ERROR;
        draft[action.taskName].message = action.message;
        break;
      case 'RESET':
        return initialTaskState;
    }
  });

const computeProgress = (tasks: TaskState): number => {
  const all = Object.values(tasks);
  const done = all.filter((t) => t.status === TaskStatus.IS_DONE).length;
  const pending = all.filter((t) => t.status === TaskStatus.IS_PENDING).length;
  return Math.round(((done + pending * 0.5) / all.length) * 100);
};

type UpdateIssuedTokenArg = z.infer<typeof schemaCreateAgreementWeb2> & {
  tokenAddress?: string;
  agreementId?: number;
  name: string;
  symbol: string;
  maxSupply?: number;
  type: TokenType;
  iconUrl?: string | File;
  transferable?: boolean;
  isVotingToken: boolean;
  decaySettings: {
    decayInterval: number;
    decayPercentage: number;
  };
  web3SpaceId: number;
  referencePrice?: number;
  referenceCurrency?: ReferenceCurrency;
  enableProposalAutoMinting?: boolean;
  enableAdvancedTransferControls?: boolean;
  transferWhitelist?: {
    to?: Array<{
      type: 'member' | 'space';
      address: string;
      includeSpaceMembers?: boolean;
    }>;
    from?: Array<{
      type: 'member' | 'space';
      address: string;
      includeSpaceMembers?: boolean;
    }>;
  };
  archiveToken?: boolean;
};

export const useUpdateIssuedTokenOrchestrator = ({
  authToken,
  config,
}: {
  authToken?: string | null;
  config?: Config;
}) => {
  const web2 = useAgreementMutationsWeb2Rsc(authToken);
  const web2TokenMutations = useTokenMutationsWeb2Rsc(authToken);
  const web3 = useUpdateIssuedTokenMutationsWeb3Rpc({
    proposalSlug: web2.createdAgreement?.slug,
  });
  const agreementFiles = useAgreementFileUploads(
    authToken,
    (uploadedFiles, slug) => {
      web2.updateAgreementBySlug({
        slug: slug ?? '',
        attachments: uploadedFiles?.attachments,
        leadImage: uploadedFiles?.leadImage,
      });
    },
  );
  const tokenFiles = useTokenFileUploads(authToken);

  const [taskState, dispatch] = useReducer(
    progressStateReducer,
    initialTaskState,
  );
  const [currentAction, setCurrentAction] = useState<string>();

  const progress = computeProgress(taskState);

  const startTask = useCallback((taskName: TaskName) => {
    const message = taskActionDescriptions[taskName];
    setCurrentAction(message);
    dispatch({ type: 'START_TASK', taskName, message });
  }, []);

  const completeTask = useCallback(
    (taskName: TaskName) => {
      if (currentAction === taskActionDescriptions[taskName]) {
        setCurrentAction(undefined);
      }
      dispatch({ type: 'COMPLETE_TASK', taskName });
    },
    [currentAction],
  );

  const errorTask = useCallback(
    (taskName: TaskName, error: string) => {
      if (currentAction === taskActionDescriptions[taskName]) {
        setCurrentAction(undefined);
      }
      dispatch({ type: 'SET_ERROR', taskName, message: error });
    },
    [currentAction],
  );

  const resetTasks = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const { trigger: updateIssuedToken } = useSWRMutation(
    'updateIssuedTokenOrchestration',
    async (_: string, { arg }: { arg: UpdateIssuedTokenArg }) => {
      if (!arg.tokenAddress || !arg.web3SpaceId) {
        throw new Error('Either tokenAddress and web3SpaceId must be provided');
      }
      startTask('CREATE_WEB2_AGREEMENT');
      const inputWeb2 = schemaCreateAgreementWeb2.parse(arg);
      const createdAgreement = await web2.createAgreement(inputWeb2);
      completeTask('CREATE_WEB2_AGREEMENT');

      const web2Slug = createdAgreement?.slug;

      let iconUrl: string | undefined;
      if (arg.iconUrl instanceof File) {
        startTask('UPLOAD_TOKEN_ICON');
        const result = await tokenFiles.upload({ iconUrl: arg.iconUrl });
        iconUrl = result.iconUrl;
        console.log('iconUrl after upload:', iconUrl);
        completeTask('UPLOAD_TOKEN_ICON');
      } else {
        startTask('UPLOAD_TOKEN_ICON');
        iconUrl = arg.iconUrl;
        completeTask('UPLOAD_TOKEN_ICON');
      }

      startTask('UPDATE_TOKEN');
      // Save token update data to DB for deferred update after proposal execution
      if (!createdAgreement?.id) {
        throw new Error('Created agreement missing ID');
      }
      const tokenUpdateData: TokenUpdateData = {
        name: arg.name,
        symbol: arg.symbol,
        maxSupply: arg.maxSupply,
        type: arg.type,
        iconUrl,
        transferable: arg.transferable,
        isVotingToken: arg.isVotingToken,
        decayInterval: arg.decaySettings?.decayInterval,
        decayPercentage: arg.decaySettings?.decayPercentage,
        referencePrice: arg.referencePrice,
        referenceCurrency: arg.referenceCurrency,
        archiveToken: arg.archiveToken,
      };
      await web2TokenMutations.createTokenUpdate({
        documentId: createdAgreement.id,
        tokenAddress: arg.tokenAddress!,
        data: tokenUpdateData,
      });
      completeTask('UPDATE_TOKEN');

      try {
        if (config) {
          startTask('CREATE_WEB3_AGREEMENT');
          const autoMinting = arg.enableProposalAutoMinting;
          const tokenPrice =
            arg.referencePrice !== undefined
              ? Math.round(arg.referencePrice * 1_000_000)
              : undefined;
          const priceCurrencyFeed =
            arg.referencePrice !== undefined &&
            arg.referenceCurrency !== undefined
              ? getPriceCurrencyFeed(arg.referenceCurrency)
              : undefined;
          const useTransferWhitelist = arg.enableAdvancedTransferControls
            ? arg.transferWhitelist?.from &&
              arg.transferWhitelist.from.length > 0
              ? true
              : false
            : undefined;
          const useReceiveWhitelist = arg.enableAdvancedTransferControls
            ? arg.transferWhitelist?.to && arg.transferWhitelist.to.length > 0
              ? true
              : false
            : undefined;

          const updateData: UpdateIssuedTokenInput = {
            address: arg.tokenAddress as `0x${string}`,
            spaceId: arg.web3SpaceId,
            name: arg.name,
            symbol: arg.symbol,
            maxSupply: arg.maxSupply,
            transferable: arg.transferable,
            decayInterval: arg.decaySettings?.decayInterval,
            decayPercentage: arg.decaySettings?.decayPercentage,
            tokenPrice,
            priceCurrencyFeed,
            autoMinting,
            useTransferWhitelist,
            useReceiveWhitelist,
            archiveToken: arg.archiveToken,
          };
          const web3Result = await web3.updateIssuedToken(updateData);
          completeTask('CREATE_WEB3_AGREEMENT');
        }

        const files = schemaCreateAgreementFiles.parse(arg);
        if (files.attachments?.length || files.leadImage) {
          startTask('UPLOAD_FILES');
          await agreementFiles.upload(files, web2Slug);
          completeTask('UPLOAD_FILES');
        } else {
          startTask('UPLOAD_FILES');
          completeTask('UPLOAD_FILES');
        }
      } catch (err) {
        if (web2Slug) {
          await web2.deleteAgreementBySlug({ slug: web2Slug });
        }
        throw err;
      }
    },
  );

  const { data: updatedWeb2Agreement } = useSWR(
    web2.createdAgreement?.slug &&
      taskState.UPLOAD_FILES.status === TaskStatus.IS_DONE &&
      taskState.CREATE_WEB3_AGREEMENT.status === TaskStatus.IS_DONE &&
      web3.updatedIssuedToken?.proposalId
      ? [
          web2.createdAgreement.slug,
          web3.updatedIssuedToken.proposalId,
          'linkingWeb2AndWeb3',
        ]
      : null,
    async ([slug, web3ProposalId]) => {
      try {
        startTask('LINK_WEB2_AND_WEB3_AGREEMENT');
        console.log('slug', slug);
        console.log('web3ProposalId', web3ProposalId);
        const result = await web2.updateAgreementBySlug({
          slug,
          web3ProposalId: Number(web3ProposalId),
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
    {
      revalidateOnMount: true,
      shouldRetryOnError: false,
    },
  );

  const errors = useMemo(
    () =>
      [
        web2.errorCreateAgreementMutation,
        web3.errorUpdateIssuedToken,
        web3.errorWaitTokenFromTx,
        web2TokenMutations.errorUpdateTokenMutation,
        web2TokenMutations.errorCreateTokenUpdateMutation,
        web2TokenMutations.errorApplyTokenUpdateMutation,
        web2TokenMutations.errorDeleteTokenUpdateMutation,
      ].filter(Boolean),
    [web2, web3, web2TokenMutations],
  );

  const reset = useCallback(() => {
    resetTasks();
    web2.resetCreateAgreementMutation();
    web3.resetUpdateIssuedToken();
    web2TokenMutations.resetUpdateTokenMutation();
    web2TokenMutations.resetCreateTokenUpdateMutation();
    web2TokenMutations.resetApplyTokenUpdateMutation();
    web2TokenMutations.resetDeleteTokenUpdateMutation();
  }, [resetTasks, web2, web3, web2TokenMutations]);

  return {
    reset,
    updateIssuedToken,
    agreement: {
      ...web2.createdAgreement,
      ...web3.updatedIssuedToken,
      ...updatedWeb2Agreement,
    },
    taskState,
    currentAction,
    progress,
    isPending: progress > 0 && progress < 100,
    isError: errors.length > 0,
    errors,
  };
};
