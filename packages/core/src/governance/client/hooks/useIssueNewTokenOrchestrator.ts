'use client';

import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { z } from 'zod';
import { produce } from 'immer';

import { useIssueTokenMutationsWeb3Rpc } from './useIssueNewTokenMutations.web3.rsc';
import { useAgreementFileUploads } from './useAgreementFileUploads';
import { useTokenFileUploads } from './useTokenFileUploads';
import { useAgreementMutationsWeb2Rsc } from './useAgreementMutations.web2.rsc';
import {
  schemaCreateAgreementWeb2,
  schemaCreateAgreementFiles,
} from '../../validation';
import { useTokenMutationsWeb2Rsc } from './useTokenMutationWeb2.rsc';
import { Config } from '@wagmi/core';
import { updateTokenAction } from '../../server/actions';
import { ReferenceCurrency } from '../../types';
import { getPriceCurrencyFeed } from '../../../common/web3/token-backing-vault';

type TaskName =
  | 'CREATE_WEB2_AGREEMENT'
  | 'CREATE_WEB3_AGREEMENT'
  | 'UPLOAD_FILES'
  | 'UPLOAD_TOKEN_ICON'
  | 'CREATE_TOKEN'
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
  CREATE_TOKEN: 'Creating token...',
  LINK_WEB2_AND_WEB3_AGREEMENT: 'Linking Web2 and Web3 agreements...',
};

const initialTaskState: TaskState = {
  CREATE_WEB2_AGREEMENT: { status: TaskStatus.IDLE },
  CREATE_WEB3_AGREEMENT: { status: TaskStatus.IDLE },
  UPLOAD_FILES: { status: TaskStatus.IDLE },
  UPLOAD_TOKEN_ICON: { status: TaskStatus.IDLE },
  CREATE_TOKEN: { status: TaskStatus.IDLE },
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

function mutationErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

type CreateIssueTokenArg = z.infer<typeof schemaCreateAgreementWeb2> & {
  agreementId?: number;
  spaceId: number;
  name: string;
  symbol: string;
  maxSupply: number;
  type:
    | 'utility'
    | 'credits'
    | 'ownership'
    | 'voice'
    | 'impact'
    | 'community_currency';
  iconUrl?: string | File;
  transferable: boolean;
  isVotingToken: boolean;
  decaySettings: {
    decayInterval: number;
    decayPercentage: number;
  };
  web3SpaceId: number;
  referencePrice?: number;
  referenceCurrency?: ReferenceCurrency;
  maxSupplyType?: { label: string; value: 'immutable' | 'updatable' };
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
};

export const useCreateIssueTokenOrchestrator = ({
  authToken,
  config,
}: {
  authToken?: string | null;
  config?: Config;
}) => {
  const web2 = useAgreementMutationsWeb2Rsc(authToken);
  const web2TokenMutations = useTokenMutationsWeb2Rsc(authToken);
  const web3 = useIssueTokenMutationsWeb3Rpc({
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

  const completeTask = useCallback((taskName: TaskName) => {
    const message = taskActionDescriptions[taskName];
    setCurrentAction((prev) => (prev === message ? undefined : prev));
    dispatch({ type: 'COMPLETE_TASK', taskName });
  }, []);

  const errorTask = useCallback((taskName: TaskName, error: string) => {
    const message = taskActionDescriptions[taskName];
    setCurrentAction((prev) => (prev === message ? undefined : prev));
    dispatch({ type: 'SET_ERROR', taskName, message: error });
  }, []);

  const resetTasks = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const { trigger: createIssueToken } = useSWRMutation(
    'createIssueTokenOrchestration',
    async (_: string, { arg }: { arg: CreateIssueTokenArg }) => {
      if (!authToken) {
        throw new Error(
          'Session not ready. Please wait a moment and try again.',
        );
      }
      web2.resetCreateAgreementMutation();
      web2TokenMutations.resetCreateTokenMutation();
      web3.resetCreateIssueToken();
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
        completeTask('UPLOAD_TOKEN_ICON');
      } else {
        iconUrl = arg.iconUrl;
        startTask('UPLOAD_TOKEN_ICON');
        completeTask('UPLOAD_TOKEN_ICON');
      }

      startTask('CREATE_TOKEN');
      const createdToken = await web2TokenMutations.createToken({
        agreementId: createdAgreement.id,
        spaceId: arg.spaceId,
        name: arg.name,
        symbol: arg.symbol,
        maxSupply: arg.maxSupply,
        type: arg.type,
        iconUrl,
        transferable: arg.transferable,
        isVotingToken: arg.isVotingToken,
        decaySettings: arg.decaySettings,
        web3SpaceId: arg.web3SpaceId,
        referencePrice: arg.referencePrice,
        referenceCurrency: arg.referenceCurrency,
      });
      completeTask('CREATE_TOKEN');

      try {
        if (config) {
          startTask('CREATE_WEB3_AGREEMENT');

          const fixedMaxSupply =
            arg.maxSupplyType?.value === 'immutable' ? true : false;
          const autoMinting = arg.enableProposalAutoMinting ?? true;
          const tokenPrice = arg.referencePrice
            ? Math.round(arg.referencePrice * 1_000_000)
            : 0;
          const priceCurrencyFeed = getPriceCurrencyFeed(arg.referenceCurrency);
          const useTransferWhitelist =
            arg.enableAdvancedTransferControls &&
            arg.transferWhitelist?.from &&
            arg.transferWhitelist.from.length > 0
              ? true
              : false;
          const useReceiveWhitelist =
            arg.enableAdvancedTransferControls &&
            arg.transferWhitelist?.to &&
            arg.transferWhitelist.to.length > 0
              ? true
              : false;

          const initialTransferWhitelist: `0x${string}`[] =
            useTransferWhitelist && arg.transferWhitelist?.from
              ? arg.transferWhitelist.from
                  .map((entry) => entry.address as `0x${string}`)
                  .filter((addr) => addr && addr.startsWith('0x'))
              : [];

          const initialReceiveWhitelist: `0x${string}`[] =
            useReceiveWhitelist && arg.transferWhitelist?.to
              ? arg.transferWhitelist.to
                  .map((entry) => entry.address as `0x${string}`)
                  .filter((addr) => addr && addr.startsWith('0x'))
              : [];

          await web3.createIssueToken({
            spaceId: arg.web3SpaceId,
            name: arg.name,
            symbol: arg.symbol,
            maxSupply: arg.maxSupply,
            transferable: arg.transferable,
            isVotingToken: arg.isVotingToken,
            type: arg.type,
            decayPercentage:
              arg.type === 'voice'
                ? arg.decaySettings.decayPercentage
                : undefined,
            decayInterval:
              arg.type === 'voice'
                ? arg.decaySettings.decayInterval
                : undefined,
            fixedMaxSupply,
            autoMinting,
            tokenPrice,
            priceCurrencyFeed,
            useTransferWhitelist,
            useReceiveWhitelist,
            initialTransferWhitelist,
            initialReceiveWhitelist,
          });
          completeTask('CREATE_WEB3_AGREEMENT');
        } else {
          completeTask('CREATE_WEB3_AGREEMENT');
          startTask('LINK_WEB2_AND_WEB3_AGREEMENT');
          completeTask('LINK_WEB2_AND_WEB3_AGREEMENT');
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

  const errors = useMemo(
    () =>
      [
        web2.errorCreateAgreementMutation,
        web2TokenMutations.errorCreateTokenMutation,
        web3.errorCreateToken,
        web3.errorWaitTokenFromTx,
      ].filter(Boolean),
    [web2, web2TokenMutations, web3],
  );

  useEffect(() => {
    if (
      web2.errorCreateAgreementMutation &&
      taskState.CREATE_WEB2_AGREEMENT.status === TaskStatus.IS_PENDING
    ) {
      errorTask(
        'CREATE_WEB2_AGREEMENT',
        mutationErrorMessage(web2.errorCreateAgreementMutation),
      );
    }
  }, [
    web2.errorCreateAgreementMutation,
    taskState.CREATE_WEB2_AGREEMENT.status,
    errorTask,
  ]);

  useEffect(() => {
    if (
      web2TokenMutations.errorCreateTokenMutation &&
      taskState.CREATE_TOKEN.status === TaskStatus.IS_PENDING
    ) {
      errorTask(
        'CREATE_TOKEN',
        mutationErrorMessage(web2TokenMutations.errorCreateTokenMutation),
      );
    }
  }, [
    web2TokenMutations.errorCreateTokenMutation,
    taskState.CREATE_TOKEN.status,
    errorTask,
  ]);

  useEffect(() => {
    if (
      web3.errorCreateToken &&
      taskState.CREATE_WEB3_AGREEMENT.status === TaskStatus.IS_PENDING
    ) {
      errorTask(
        'CREATE_WEB3_AGREEMENT',
        mutationErrorMessage(web3.errorCreateToken),
      );
    }
  }, [
    web3.errorCreateToken,
    taskState.CREATE_WEB3_AGREEMENT.status,
    errorTask,
  ]);

  useEffect(() => {
    if (
      web3.errorWaitTokenFromTx &&
      taskState.CREATE_WEB3_AGREEMENT.status === TaskStatus.IS_DONE &&
      taskState.LINK_WEB2_AND_WEB3_AGREEMENT.status === TaskStatus.IDLE
    ) {
      errorTask(
        'LINK_WEB2_AND_WEB3_AGREEMENT',
        mutationErrorMessage(web3.errorWaitTokenFromTx),
      );
    }
  }, [
    web3.errorWaitTokenFromTx,
    taskState.CREATE_WEB3_AGREEMENT.status,
    taskState.LINK_WEB2_AND_WEB3_AGREEMENT.status,
    errorTask,
  ]);

  const { data: updatedWeb2Agreement } = useSWR(
    web2.createdAgreement?.slug &&
      taskState.UPLOAD_FILES.status === TaskStatus.IS_DONE &&
      taskState.CREATE_WEB3_AGREEMENT.status === TaskStatus.IS_DONE &&
      web3.createdToken?.proposalId
      ? [
          web2.createdAgreement.slug,
          web3.createdToken.proposalId,
          'linkingWeb2AndWeb3',
        ]
      : null,
    async ([slug, web3ProposalId]) => {
      try {
        startTask('LINK_WEB2_AND_WEB3_AGREEMENT');
        const result = await web2.updateAgreementBySlug({
          slug,
          web3ProposalId: Number(web3ProposalId),
        });

        await updateTokenAction(
          {
            agreementId: web2.createdAgreement!.id,
            agreementWeb3IdUpdate: Number(web3ProposalId),
          },
          { authToken: authToken! },
        );

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

  const reset = useCallback(() => {
    resetTasks();
    web2.resetCreateAgreementMutation();
    web2TokenMutations.resetCreateTokenMutation();
    web3.resetCreateIssueToken();
  }, [resetTasks, web2, web2TokenMutations, web3]);

  return {
    reset,
    createIssueToken,
    agreement: {
      ...web2.createdAgreement,
      ...web3.createdToken,
      ...updatedWeb2Agreement,
    },
    taskState,
    currentAction,
    progress,
    isPending: errors.length === 0 && progress > 0 && progress < 100,
    isError: errors.length > 0,
    errors,
  };
};
