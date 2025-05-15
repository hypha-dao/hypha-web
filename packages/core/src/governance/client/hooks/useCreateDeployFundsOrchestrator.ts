'use client';

import React, { useCallback, useReducer, useState, useMemo } from 'react';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { Config } from '@wagmi/core';
import { produce } from 'immer';
import { z } from 'zod';

import {
  schemaCreateAgreement,
  schemaCreateAgreementWeb2,
  schemaCreateAgreementFiles,
} from '../../validation';

import { useAgreementFileUploads } from './useAgreementFileUploads';
import { useAgreementMutationsWeb2Rsc } from './useAgreementMutations.web2.rsc';
import { useDeployFundsMutationsWeb3Rpc } from './useDeployFundsMutations.web3.rpc';

type CreateDeployFundsArg = z.infer<typeof schemaCreateAgreement> & {
  payouts: { amount: string; token: string }[];
  recipient: string;
  web3SpaceId?: number;
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

const initialTaskState: TaskState = {
  CREATE_WEB2_AGREEMENT: { status: TaskStatus.IDLE },
  CREATE_WEB3_AGREEMENT: { status: TaskStatus.IDLE },
  UPLOAD_FILES: { status: TaskStatus.IDLE },
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

export const useCreateDeployFundsOrchestrator = ({
  authToken,
  config,
}: {
  authToken?: string | null;
  config?: Config;
}) => {
  const agreementFiles = useAgreementFileUploads(authToken);
  const web2 = useAgreementMutationsWeb2Rsc(authToken);
  const web3 = useDeployFundsMutationsWeb3Rpc(config);

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
