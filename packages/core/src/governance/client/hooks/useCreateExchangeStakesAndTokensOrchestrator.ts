'use client';

import React, { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { Config } from '@wagmi/core';
import { z } from 'zod';
import { produce } from 'immer';

import {
  schemaCreateAgreementWeb2,
  schemaCreateAgreementFiles,
  schemaExchangeStakesAndTokens,
} from '../../validation';

import { useAgreementMutationsWeb2Rsc } from './useAgreementMutations.web2.rsc';
import { useExchangeStakesAndTokensMutationsWeb3Rpc } from './useExchangeStakesAndTokensMutations.web3.rpc';
import { useAgreementFileUploads } from './useAgreementFileUploads';

type CreateExchangeArg = z.infer<typeof schemaExchangeStakesAndTokens> & {
  web3SpaceId?: number;
  /** Escrow party A: seller executor when seller is a space, else seller wallet */
  sellerPartyAForEscrow?: string;
  /** Escrow `partyB`: buyer executor when buyer is a space, else buyer wallet/space contract */
  buyerPartyBForEscrow?: string;
};

type TaskName =
  | 'CREATE_WEB2_AGREEMENT'
  | 'CREATE_WEB3_AGREEMENT'
  | 'UPLOAD_FILES'
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
  CREATE_WEB2_AGREEMENT: 'Creating Web2 agreement...',
  CREATE_WEB3_AGREEMENT: 'Creating Web3 agreement...',
  UPLOAD_FILES: 'Uploading Agreement Files...',
  LINK_WEB2_AND_WEB3_AGREEMENT: 'Linking Web2 and Web3 agreements',
};

type ProgressAction =
  | { type: 'START_TASK'; taskName: TaskName; message?: string }
  | { type: 'COMPLETE_TASK'; taskName: TaskName; message?: string }
  | { type: 'SET_ERROR'; taskName: TaskName; message: string }
  | { type: 'RESET' };

const initialTaskState: TaskState = {
  CREATE_WEB2_AGREEMENT: { status: TaskStatus.IDLE },
  CREATE_WEB3_AGREEMENT: { status: TaskStatus.IDLE },
  UPLOAD_FILES: { status: TaskStatus.IDLE },
  LINK_WEB2_AND_WEB3_AGREEMENT: { status: TaskStatus.IDLE },
};

const progressStateReducer = (
  state: TaskState,
  action: ProgressAction,
): TaskState => {
  return produce(state, (draft) => {
    switch (action.type) {
      case 'START_TASK':
        draft[action.taskName].status = TaskStatus.IS_PENDING;
        if (action.message) {
          draft[action.taskName].message = action.message;
        }
        break;
      case 'COMPLETE_TASK':
        draft[action.taskName].status = TaskStatus.IS_DONE;
        if (action.message) {
          draft[action.taskName].message = action.message;
        }
        break;
      case 'SET_ERROR':
        draft[action.taskName].status = TaskStatus.ERROR;
        draft[action.taskName].message = action.message;
        break;
      case 'RESET':
        return initialTaskState;
    }
  });
};

const computeProgress = (tasks: TaskState): number => {
  const taskList = Object.values(tasks);
  const totalTasks = taskList.length;
  if (totalTasks === 0) return 0;
  const completedTasks = taskList.filter(
    (t) => t.status === TaskStatus.IS_DONE,
  ).length;
  const inProgressTasks =
    taskList.filter((t) => t.status === TaskStatus.IS_PENDING).length * 0.5;
  const progress = ((completedTasks + inProgressTasks) / totalTasks) * 100;
  return Math.min(100, Math.max(0, Math.round(progress)));
};

export const useCreateExchangeStakesAndTokensOrchestrator = ({
  authToken,
  config,
}: {
  authToken?: string | null;
  config?: Config;
}) => {
  const web2 = useAgreementMutationsWeb2Rsc(authToken);
  const web3 = useExchangeStakesAndTokensMutationsWeb3Rpc({
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

  const [taskState, dispatch] = React.useReducer(
    progressStateReducer,
    initialTaskState,
  );
  const progress = computeProgress(taskState);
  const [currentAction, setCurrentAction] = React.useState<string>();

  const startTask = useCallback((taskName: TaskName) => {
    const action = taskActionDescriptions[taskName];
    setCurrentAction(action);
    dispatch({ type: 'START_TASK', taskName, message: action });
  }, []);

  const completeTask = useCallback(
    (taskName: TaskName) => {
      if (currentAction === taskActionDescriptions[taskName])
        setCurrentAction(undefined);
      dispatch({ type: 'COMPLETE_TASK', taskName });
    },
    [currentAction],
  );

  const errorTask = useCallback(
    (taskName: TaskName, error: string) => {
      if (currentAction === taskActionDescriptions[taskName])
        setCurrentAction(undefined);
      dispatch({ type: 'SET_ERROR', taskName, message: error });
    },
    [currentAction],
  );

  const resetTasks = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const { trigger: createExchangeStakesAndTokens } = useSWRMutation(
    'createExchangeStakesAndTokensOrchestration',
    async (_: string, { arg }: { arg: CreateExchangeArg }) => {
      startTask('CREATE_WEB2_AGREEMENT');
      const inputWeb2 = schemaCreateAgreementWeb2.parse(arg);
      const createdAgreement = await web2.createAgreement(inputWeb2);
      completeTask('CREATE_WEB2_AGREEMENT');

      const web2Slug = createdAgreement?.slug ?? web2.createdAgreement?.slug;
      const web3SpaceId = arg.web3SpaceId;

      try {
        if (config && typeof web3SpaceId === 'number') {
          startTask('CREATE_WEB3_AGREEMENT');
          await web3.createExchangeStakesAndTokens({
            spaceId: web3SpaceId,
            sellerAddress: arg.sellerAddress,
            sellerLeg: arg.sellerLeg,
            buyerAddress: arg.buyerAddress,
            buyerLeg: arg.buyerLeg,
            sellerRecipientType: arg.sellerRecipientType,
            sellerPartyAForEscrow:
              arg.sellerPartyAForEscrow ?? arg.sellerAddress,
            buyerPartyBForEscrow: arg.buyerPartyBForEscrow ?? arg.buyerAddress,
          });
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
      (!config || taskState.CREATE_WEB3_AGREEMENT.status === TaskStatus.IS_DONE)
      ? [
          web2.createdAgreement.slug,
          web3.createdExchangeStakesAndTokens?.proposalId,
          'linkingWeb2AndWeb3',
        ]
      : null,
    async ([slug, web3ProposalId]) => {
      try {
        startTask('LINK_WEB2_AND_WEB3_AGREEMENT');
        const result = await web2.updateAgreementBySlug({
          slug,
          web3ProposalId: web3ProposalId ? Number(web3ProposalId) : undefined,
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
        web3.errorCreateExchangeStakesAndTokens,
      ].filter(Boolean),
    [web2, web3],
  );

  const reset = useCallback(() => {
    resetTasks();
    web2.resetCreateAgreementMutation();
    web3.resetCreateExchangeStakesAndTokensMutation();
  }, [resetTasks, web2, web3]);

  return {
    reset,
    createExchangeStakesAndTokens,
    agreement: {
      ...web2.createdAgreement,
      ...web3.createdExchangeStakesAndTokens,
      ...updatedWeb2Agreement,
    },
    taskState,
    currentAction,
    progress,
    isPending:
      (progress > 0 && progress < 100) ||
      Object.values(taskState).some(
        (task) => task.status === TaskStatus.IS_PENDING,
      ),
    isError: errors.length > 0,
    errors,
  };
};
