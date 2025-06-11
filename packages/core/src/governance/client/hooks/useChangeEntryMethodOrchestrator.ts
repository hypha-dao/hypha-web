'use client';

import useSWR from 'swr';
import { Config } from '@wagmi/core';
import { z } from 'zod';
import { produce } from 'immer';
import React, { useCallback } from 'react';

import { useChangeEntryMethodMutationsWeb3Rpc } from './useChangeEntryMethodMutations.web3.rpc';
import useSWRMutation from 'swr/mutation';
import {
  schemaCreateAgreementWeb2,
  schemaCreateAgreementFiles,
} from '../../validation';
import { EntryMethodType, TokenBase } from '@core/governance/types';
import { useAgreementFileUploads, useAgreementMutationsWeb2Rsc } from '@hypha-platform/core/client';

type UseCreateChangeEntryMethodOrchestratorInput = {
  authToken?: string | null;
  config?: Config;
};

type TaskName =
  | 'CREATE_WEB2_CHANGE_ENTRY_METHOD'
  | 'CREATE_WEB3_CHANGE_ENTRY_METHOD'
  | 'UPLOAD_FILES'
  | 'LINK_WEB2_AND_WEB3_CHANGE_ENTRY_METHOD';

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
  CREATE_WEB2_CHANGE_ENTRY_METHOD: 'Creating Web2 change entry method...',
  CREATE_WEB3_CHANGE_ENTRY_METHOD: 'Creating Web3 change entry method...',
  UPLOAD_FILES: 'Uploading Agreement Files...',
  LINK_WEB2_AND_WEB3_CHANGE_ENTRY_METHOD:
    'Linking Web2 and Web3 change entry method',
};

type ProgressAction =
  | { type: 'START_TASK'; taskName: TaskName; message?: string }
  | { type: 'COMPLETE_TASK'; taskName: TaskName; message?: string }
  | { type: 'SET_ERROR'; taskName: TaskName; message: string }
  | { type: 'RESET' };

const initialTaskState: TaskState = {
  CREATE_WEB2_CHANGE_ENTRY_METHOD: { status: TaskStatus.IDLE },
  CREATE_WEB3_CHANGE_ENTRY_METHOD: { status: TaskStatus.IDLE },
  UPLOAD_FILES: { status: TaskStatus.IDLE },
  LINK_WEB2_AND_WEB3_CHANGE_ENTRY_METHOD: { status: TaskStatus.IDLE },
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

type CreateChangeEntryMethodArg = z.infer<
  typeof schemaCreateAgreementWeb2
> & {
  entryMethod: number;
  web3SpaceId?: number;
  tokenBase?: TokenBase;
};

export const useChangeEntryMethodOrchestrator = ({
  authToken,
  config,
}: UseCreateChangeEntryMethodOrchestratorInput) => {
  const agreementFiles = useAgreementFileUploads(authToken);
  const web2 = useAgreementMutationsWeb2Rsc(authToken);
  const web3 = useChangeEntryMethodMutationsWeb3Rpc(config);

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

  const { trigger: createChangeEntryMethod } = useSWRMutation(
    'createChangeEntryMethodOrchestration',
    async (_, { arg }: { arg: CreateChangeEntryMethodArg }) => {
      startTask('CREATE_WEB2_CHANGE_ENTRY_METHOD');
      const inputWeb2 =
        schemaCreateAgreementWeb2.parse(arg);
      const createdAgreement = await web2.createAgreement(
        inputWeb2,
      );
      completeTask('CREATE_WEB2_CHANGE_ENTRY_METHOD');

      const web2Slug = createdAgreement?.slug;
      const web3SpaceId = arg.web3SpaceId;
      const joinMethod = arg.entryMethod;
      const tokenBase = arg.tokenBase;
      try {
        if (config) {
          if (typeof web3SpaceId !== 'number') {
            throw new Error(
              'web3SpaceId is required for web3 proposal creation',
            );
          }
          if (typeof joinMethod !== 'number') {
            throw new Error(
              'joinMethod is required for web3 proposal creation',
            );
          }
          if (
            joinMethod === EntryMethodType.TOKEN_BASED &&
            typeof tokenBase === 'undefined'
          ) {
            throw new Error(
              'tokenBase is required for web3 proposal creation when token based',
            );
          }
          startTask('CREATE_WEB3_CHANGE_ENTRY_METHOD');
          await web3.createChangeEntryMethod({
            spaceId: web3SpaceId,
            joinMethod: joinMethod,
            tokenBase: tokenBase,
          });
          completeTask('CREATE_WEB3_CHANGE_ENTRY_METHOD');
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
          web3.changeEntryMethodData?.proposalId,
          'linkingWeb2AndWeb3Token',
        ]
      : null,
    async ([slug, uploadedFiles, web3ProposalId]) => {
      try {
        startTask('LINK_WEB2_AND_WEB3_CHANGE_ENTRY_METHOD');
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
        completeTask('LINK_WEB2_AND_WEB3_CHANGE_ENTRY_METHOD');
        return result;
      } catch (error) {
        if (error instanceof Error) {
          errorTask('LINK_WEB2_AND_WEB3_CHANGE_ENTRY_METHOD', error.message);
        }
        throw error;
      }
    },
  );

  const errors = React.useMemo(() => {
    return [
      web2.errorCreateAgreementMutation,
      web3.errorChangeEntryMethod,
      web3.errorWaitProposalFromTx,
    ].filter(Boolean);
  }, [web2, web3]);

  const reset = useCallback(() => {
    resetTasks();
    web2.resetCreateAgreementMutation();
    web3.resetChangeEntryMethod();
  }, [resetTasks, web2, web3]);

  return {
    reset,
    createChangeEntryMethod,
    changeEntryMethod: {
      ...updatedWeb2Agreement,
      ...web3.changeEntryMethodData,
    },
    taskState,
    currentAction,
    progress,
    isPending: progress > 0 && progress < 100,
    isError: errors.length > 0,
    errors,
  };
};
