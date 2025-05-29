'use client';

import useSWR from 'swr';
import { Config } from '@wagmi/core';
import { z } from 'zod';
import { produce } from 'immer';
import React, { useCallback } from 'react';

import { useChangeEntryMethodMutationsWeb2Rpc } from './useChangeEntryMethodMutations.web2.rpc';
import { useChangeEntryMethodMutationsWeb3Rpc } from './useChangeEntryMethodMutations.web3.rpc';
import useSWRMutation from 'swr/mutation';
import {
  schemaCreateChangeEntryMethod,
  schemaCreateChangeEntryMethodFiles,
  schemaCreateChangeEntryMethodWeb2,
} from '../../validation';
import { useChangeEntryMethodFileUploads } from './useChangeEntryMethodFileUploads';

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
  LINK_WEB2_AND_WEB3_CHANGE_ENTRY_METHOD: 'Linking Web2 and Web3 change entry method',
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

type CreateChangeEntryMethodArg = z.infer<typeof schemaCreateChangeEntryMethod> & {
  entryMethod: number;
  web3SpaceId?: number;
};

export const useCreateChangeEntryMethodOrchestrator = ({
  authToken,
  config,
}: UseCreateChangeEntryMethodOrchestratorInput) => {
  const changeEntryMethodFiles = useChangeEntryMethodFileUploads(authToken);
  const web2 = useChangeEntryMethodMutationsWeb2Rpc(authToken);
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
      const inputCreateChangeEntryMethodWeb2 = schemaCreateChangeEntryMethodWeb2.parse(arg);
      const createdChangeEntryMethod = await web2.createChangeEntryMethod(
        inputCreateChangeEntryMethodWeb2,
      );
      completeTask('CREATE_WEB2_CHANGE_ENTRY_METHOD');

      let web3ProposalResult = undefined;
      const web2Slug = createdChangeEntryMethod?.slug ?? web2.createdChangeEntryMethod?.slug;
      const web3SpaceId = (arg as any).web3SpaceId;
      const joinMethod = (arg as any).joinMethod;
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
          startTask('CREATE_WEB3_CHANGE_ENTRY_METHOD');
          web3ProposalResult = await web3.createChangeEntryMethod({
            spaceId: web3SpaceId,
            joinMethod: joinMethod,
          });
          completeTask('CREATE_WEB3_CHANGE_ENTRY_METHOD');
        }
      } catch (err) {
        if (web2Slug) {
          await web2.deleteChangeEntryMethodBySlug({ slug: web2Slug });
        }
        throw err;
      }

      startTask('UPLOAD_FILES');
      const inputFiles = schemaCreateChangeEntryMethodFiles.parse(arg);
      await changeEntryMethodFiles.upload(inputFiles);
      completeTask('UPLOAD_FILES');
    },
  );

  const { data: updatedWeb2ChangeEntryMethod } = useSWR(
    web2.createdChangeEntryMethod?.slug && changeEntryMethodFiles.files
      ? [
          web2.createdChangeEntryMethod.slug,
          changeEntryMethodFiles.files,
          web3.createdChangeEntryMethod?.proposalId,
          'updatingCreatedChangeEntryMethod',
        ]
      : null,
    async ([slug, uploadedFiles, web3ProposalId]) => {
      try {
        startTask('LINK_WEB2_AND_WEB3_CHANGE_ENTRY_METHOD');
        const result = await web2.updateChangeEntryMethodBySlug({
          slug,
          web3ProposalId: web3ProposalId ? Number(web3ProposalId) : undefined,
          attachments: uploadedFiles.attachments
            ? Array.isArray(uploadedFiles.attachments)
              ? uploadedFiles.attachments
              : [uploadedFiles.attachments]
            : [],
          image: uploadedFiles.image,
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
      web2.errorCreateChangeEntryMethodMutation,
      web3.errorCreateChangeEntryMethod,
      web3.errorWaitChangeEntryMethodFromTransaction,
    ].filter(Boolean);
  }, [
    web2.errorCreateChangeEntryMethodMutation,
    web3.errorCreateChangeEntryMethod,
    web3.errorWaitChangeEntryMethodFromTransaction,
  ]);

  const reset = useCallback(() => {
    resetTasks();
    web2.resetCreateChangeEntryMethodMutation();
    web3.resetCreateChangeEntryMethodMutation();
  }, [resetTasks, web2, web3]);

  return {
    reset,
    createChangeEntryMethod,
    changeEntryMethod: {
      ...updatedWeb2ChangeEntryMethod,
      ...web3.createdChangeEntryMethod,
    },
    taskState,
    currentAction,
    progress,
    isPending: progress > 0 && progress < 100,
    isError: errors.length > 0,
    errors,
  };
};
