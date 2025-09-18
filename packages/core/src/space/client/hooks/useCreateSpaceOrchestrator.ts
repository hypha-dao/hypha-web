'use client';

import useSWR from 'swr';
import { Config } from '@wagmi/core';
import { z } from 'zod';
import { produce } from 'immer';
import React, { useCallback } from 'react';

import { useSpaceMutationsWeb2Rsc } from './useSpaceMutations.web2.rsc';
import { useSpaceMutationsWeb3Rpc } from './useSpaceMutations.web3.rpc';
import useSWRMutation from 'swr/mutation';
import {
  schemaCreateSpace,
  schemaCreateSpaceFiles,
  schemaCreateSpaceWeb2,
  schemaCreateSpaceWeb3,
} from '../../validation';
import { useSpaceFileUploads } from './useSpaceFileUploads';

type UseCreateSpaceOrchestratorInput = {
  authToken?: string | null;
  config: Config;
};

export type TaskName =
  | 'CREATE_WEB2_SPACE'
  | 'CREATE_WEB3_SPACE'
  | 'UPLOAD_FILES'
  | 'LINK_WEB2_AND_WEB3_SPACE';

export type TaskState = {
  [K in TaskName]: {
    status: TaskStatus;
    message?: string;
  };
};

export enum TaskStatus {
  IDLE = 'idle',
  IS_PENDING = 'isPending',
  IS_DONE = 'isDone',
  ERROR = 'error',
}

const taskActionDescriptions: Record<TaskName, string> = {
  CREATE_WEB2_SPACE: 'Creating Web2 space...',
  CREATE_WEB3_SPACE: 'Creating Web3 space...',
  UPLOAD_FILES: 'Uploading Space Images...',
  LINK_WEB2_AND_WEB3_SPACE: 'Linking Web2 and Web3 spaces...',
};

export type ProgressAction =
  | { type: 'START_TASK'; taskName: TaskName; message?: string }
  | { type: 'COMPLETE_TASK'; taskName: TaskName; message?: string }
  | { type: 'SET_ERROR'; taskName: TaskName; message: string }
  | { type: 'RESET' };

const initialTaskState: TaskState = {
  CREATE_WEB2_SPACE: { status: TaskStatus.IDLE },
  CREATE_WEB3_SPACE: { status: TaskStatus.IDLE },
  UPLOAD_FILES: { status: TaskStatus.IDLE },
  LINK_WEB2_AND_WEB3_SPACE: { status: TaskStatus.IDLE },
};

export const progressStateReducer = (
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
    (task) => task.status === TaskStatus.IS_DONE,
  ).length;
  const inProgressTasks =
    taskList.filter((task) => task.status === TaskStatus.IS_PENDING).length *
    0.5;
  const progress = ((completedTasks + inProgressTasks) / totalTasks) * 100;
  return Math.min(100, Math.max(0, Math.round(progress)));
};

export const useCreateSpaceOrchestrator = ({
  authToken,
  config,
}: UseCreateSpaceOrchestratorInput) => {
  const web2 = useSpaceMutationsWeb2Rsc(authToken);
  const web3 = useSpaceMutationsWeb3Rpc();
  const spaceFiles = useSpaceFileUploads(authToken, (uploadedFiles, slug) => {
    web2.updateSpaceBySlug({
      slug: slug ?? '',
      ...uploadedFiles,
    });
  });

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

  const { trigger: createSpace } = useSWRMutation(
    'createSpaceOrchestration',
    async (_, { arg }: { arg: z.infer<typeof schemaCreateSpace> }) => {
      startTask('CREATE_WEB2_SPACE');
      const inputCreateSpaceWeb2 = schemaCreateSpaceWeb2.parse(arg);
      const createdSpace = await web2.createSpace(inputCreateSpaceWeb2);
      completeTask('CREATE_WEB2_SPACE');

      startTask('CREATE_WEB3_SPACE');
      const inputCreateSpaceWeb3 = schemaCreateSpaceWeb3.parse({
        quorum: 50,
        unity: 80,
        votingPowerSource: 2,
        joinMethod: 2,
        exitMethod: 0,
      });
      await web3.createSpace(inputCreateSpaceWeb3);
      completeTask('CREATE_WEB3_SPACE');

      const files = schemaCreateSpaceFiles.parse(arg);
      if (Object.values(files).some((file) => file)) {
        startTask('UPLOAD_FILES');
        await spaceFiles.upload(files, createdSpace?.slug);
        completeTask('UPLOAD_FILES');
      } else {
        startTask('UPLOAD_FILES');
        completeTask('UPLOAD_FILES');
      }
    },
  );

  const { data: updatedWeb2Space } = useSWR(
    web2.createdSpace?.slug &&
      taskState.CREATE_WEB3_SPACE.status === TaskStatus.IS_DONE &&
      taskState.UPLOAD_FILES.status === TaskStatus.IS_DONE
      ? [
          web2.createdSpace.slug,
          web3.createdSpace?.spaceId,
          web3.createdSpace?.executor,
          'linkingWeb2AndWeb3Space',
        ]
      : null,
    async ([slug, web3SpaceId, address]) => {
      try {
        startTask('LINK_WEB2_AND_WEB3_SPACE');
        const result = await web2.updateSpaceBySlug({
          slug,
          web3SpaceId: Number(web3SpaceId),
          address: address,
        });
        completeTask('LINK_WEB2_AND_WEB3_SPACE');
        return result;
      } catch (error) {
        if (error instanceof Error) {
          errorTask('LINK_WEB2_AND_WEB3_SPACE', error.message);
        }
        throw error;
      }
    },
    {
      revalidateOnMount: true,
      shouldRetryOnError: false,
    },
  );

  const errors = React.useMemo(() => {
    return [
      web2.errorCreateSpaceMutation,
      web2.errorUpdateSpaceBySlugMutation,
      web3.errorCreateSpace,
      web3.errorWaitSpaceFromTransaction,
      spaceFiles.error,
    ].filter(Boolean);
  }, [
    web2.errorCreateSpaceMutation,
    web2.errorUpdateSpaceBySlugMutation,
    web3.errorCreateSpace,
    web3.errorWaitSpaceFromTransaction,
    spaceFiles.error,
  ]);

  const reset = useCallback(() => {
    resetTasks();
    web2.resetCreateSpaceMutation();
    web2.resetUpdateSpaceBySlugMutation();
    web3.resetCreateSpaceMutation();
    spaceFiles.reset();
  }, [resetTasks, web2, web3, spaceFiles]);

  return {
    reset,
    createSpace,
    space: {
      ...web2.createdSpace,
      ...web3.createdSpace,
      ...updatedWeb2Space,
    },
    taskState,
    currentAction,
    progress,
    isPending: progress > 0 && progress < 100,
    isError: errors.length > 0,
    errors,
  };
};
