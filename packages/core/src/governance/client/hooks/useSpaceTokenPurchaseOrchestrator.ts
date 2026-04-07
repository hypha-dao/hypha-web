'use client';

import React, { useCallback, useMemo } from 'react';
import useSWRMutation from 'swr/mutation';
import { z } from 'zod';
import { produce } from 'immer';
import { Config } from '@wagmi/core';

import {
  schemaCreateAgreement,
  schemaCreateAgreementWeb2,
  schemaCreateAgreementFiles,
} from '../../validation';

import { useAgreementFileUploads } from './useAgreementFileUploads';
import { useAgreementMutationsWeb2Rsc } from './useAgreementMutations.web2.rsc';
import { useSpaceTokenPurchaseMutationsWeb3Rpc } from './useSpaceTokenPurchaseMutations.web3.rsc';
import { getProposalFromLogs, web3ProposalIdForDb } from '../web3';
import { publicClient } from '../../../common/web3/public-client';

type CreateSpaceTokenPurchaseArg = z.infer<typeof schemaCreateAgreement> & {
  tokenAddress: string;
  activatePurchase: boolean;
  purchasePrice?: number;
  purchaseCurrency?: string;
  tokensAvailableForPurchase?: number;
  web3SpaceId?: number;
};

export type SpaceTokenPurchaseTaskName =
  | 'CREATE_WEB2_AGREEMENT'
  | 'CREATE_WEB3_PROPOSAL'
  | 'UPLOAD_FILES'
  | 'LINK_WEB2_AND_WEB3_AGREEMENT';

type TaskName = SpaceTokenPurchaseTaskName;

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

type ProgressAction =
  | { type: 'START_TASK'; taskName: TaskName; message?: string }
  | { type: 'COMPLETE_TASK'; taskName: TaskName; message?: string }
  | { type: 'SET_ERROR'; taskName: TaskName; message: string }
  | { type: 'RESET' };

const initialTaskState: TaskState = {
  CREATE_WEB2_AGREEMENT: { status: TaskStatus.IDLE },
  CREATE_WEB3_PROPOSAL: { status: TaskStatus.IDLE },
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

export const useSpaceTokenPurchaseOrchestrator = ({
  authToken,
  config,
}: {
  authToken?: string | null;
  config?: Config;
}) => {
  const web2 = useAgreementMutationsWeb2Rsc(authToken);
  const web3 = useSpaceTokenPurchaseMutationsWeb3Rpc({
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
  const taskStateRef = React.useRef(taskState);
  React.useEffect(() => {
    taskStateRef.current = taskState;
  }, [taskState]);
  const progress = computeProgress(taskState);
  const [currentTask, setCurrentTask] = React.useState<TaskName | null>(null);

  const startTask = useCallback((taskName: TaskName) => {
    setCurrentTask(taskName);
    dispatch({ type: 'START_TASK', taskName });
  }, []);

  const completeTask = useCallback(
    (taskName: TaskName) => {
      if (currentTask === taskName) setCurrentTask(null);
      dispatch({ type: 'COMPLETE_TASK', taskName });
    },
    [currentTask],
  );

  const errorTask = useCallback(
    (taskName: TaskName, error: string) => {
      if (currentTask === taskName) setCurrentTask(null);
      dispatch({ type: 'SET_ERROR', taskName, message: error });
    },
    [currentTask],
  );

  const resetTasks = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const { trigger: createSpaceTokenPurchase } = useSWRMutation(
    'createSpaceTokenPurchaseOrchestration',
    async (_: string, { arg }: { arg: CreateSpaceTokenPurchaseArg }) => {
      startTask('CREATE_WEB2_AGREEMENT');
      const inputWeb2 = schemaCreateAgreementWeb2.parse({
        ...arg,
        label: 'Token Purchase',
      });
      const createdAgreement = await web2.createAgreement(inputWeb2);
      completeTask('CREATE_WEB2_AGREEMENT');

      const web2Slug = createdAgreement?.slug ?? web2.createdAgreement?.slug;
      if (!web2Slug) {
        throw new Error('Agreement slug missing after create');
      }

      try {
        // Upload files before creating the irreversible on-chain proposal
        startTask('UPLOAD_FILES');
        const files = schemaCreateAgreementFiles.parse(arg);
        if (files.attachments?.length || files.leadImage) {
          await agreementFiles.upload(files, web2Slug as string);
        }
        completeTask('UPLOAD_FILES');

        if (config) {
          startTask('CREATE_WEB3_PROPOSAL');
          const txHash = await web3.createSpaceTokenPurchaseProposal({
            spaceId: arg.web3SpaceId ?? arg.spaceId,
            tokenAddress: arg.tokenAddress as `0x${string}`,
            activatePurchase: arg.activatePurchase,
            purchasePrice: arg.purchasePrice,
            purchaseCurrency: arg.purchaseCurrency,
            tokensAvailableForPurchase: arg.tokensAvailableForPurchase,
          });
          completeTask('CREATE_WEB3_PROPOSAL');

          const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash as `0x${string}`,
          });
          const proposalEvent = getProposalFromLogs(receipt.logs);
          const proposalId = proposalEvent?.proposalId;
          if (proposalId === undefined) {
            throw new Error('Proposal ID not found in transaction receipt');
          }

          startTask('LINK_WEB2_AND_WEB3_AGREEMENT');
          await web2.updateAgreementBySlug({
            slug: web2Slug,
            web3ProposalId: web3ProposalIdForDb(proposalId),
          });
          completeTask('LINK_WEB2_AND_WEB3_AGREEMENT');
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong';
        for (const taskName of Object.keys(
          taskStateRef.current,
        ) as TaskName[]) {
          if (taskStateRef.current[taskName].status === TaskStatus.IS_PENDING) {
            errorTask(taskName, message);
          }
        }
        setCurrentTask(null);
        await web2.deleteAgreementBySlug({ slug: web2Slug });
        throw err;
      }
    },
  );

  const taskErrorMessages = useMemo(
    () =>
      (
        Object.values(taskState) as Array<{
          status: TaskStatus;
          message?: string;
        }>
      )
        .filter((t) => t.status === TaskStatus.ERROR && t.message)
        .map((t) => t.message as string),
    [taskState],
  );

  const hasTaskFailure = useMemo(
    () =>
      (Object.values(taskState) as Array<{ status: TaskStatus }>).some(
        (t) => t.status === TaskStatus.ERROR,
      ),
    [taskState],
  );

  const hasTaskPending = useMemo(
    () =>
      (Object.values(taskState) as Array<{ status: TaskStatus }>).some(
        (t) => t.status === TaskStatus.IS_PENDING,
      ),
    [taskState],
  );

  const errors = useMemo(
    () =>
      [
        web2.errorCreateAgreementMutation,
        web2.errorUpdateAgreementBySlugMutation,
        web3.createSpaceTokenPurchaseError,
        ...taskErrorMessages,
      ].filter(Boolean),
    [web2, web3, taskErrorMessages],
  );

  const reset = useCallback(() => {
    resetTasks();
    web2.resetCreateAgreementMutation();
    web3.resetCreateSpaceTokenPurchaseProposal();
  }, [resetTasks, web2, web3]);

  return {
    reset,
    createSpaceTokenPurchase,
    agreement: {
      ...web2.createdAgreement,
      ...web2.updatedAgreement,
    },
    taskState,
    /** i18n: map with AgreementFlow.spaceTokenPurchaseProgress */
    currentTask,
    progress,
    isPending:
      !hasTaskFailure && (hasTaskPending || (progress > 0 && progress < 100)),
    isError: errors.length > 0 || hasTaskFailure,
    errors,
  };
};
