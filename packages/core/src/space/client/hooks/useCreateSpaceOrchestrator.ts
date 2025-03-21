import { Config } from '@wagmi/core';
import { z } from 'zod';
import { produce } from 'immer';
import React, { useCallback } from 'react';

import { useSpaceMutationsWeb2Rsc } from './useSpaceMutations.web2.rsc';
import { useSpaceMutationsWeb3Rpc } from './useSpaceMutations.web3.rpc';
import useSWRMutation from 'swr/mutation';
import {
  schemaCreateSpace,
  schemaCreateSpaceWeb2,
  schemaCreateSpaceWeb3,
} from '../../validation';
import useSWR from 'swr';

type UseCreateSpaceOrchestratorInput = {
  authToken?: string | null;
  config: Config;
};

export type TaskName =
  | 'CREATE_WEB2_SPACE'
  | 'CREATE_WEB3_SPACE'
  | 'GET_WEB3_SPACE_CREATED_EVENT'
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
  GET_WEB3_SPACE_CREATED_EVENT: 'Retrieving Web3 space creation event...',
  LINK_WEB2_AND_WEB3_SPACE: 'Linking Web2 and Web3 spaces...',
};

// Action types for the reducer
export type ProgressAction =
  | { type: 'START_TASK'; taskName: TaskName; message?: string }
  | { type: 'COMPLETE_TASK'; taskName: TaskName; message?: string }
  | { type: 'SET_ERROR'; taskName: TaskName; message: string }
  | { type: 'RESET' };

// Initial state definition
const initialTaskState: TaskState = {
  CREATE_WEB2_SPACE: {
    status: TaskStatus.IDLE,
  },
  CREATE_WEB3_SPACE: {
    status: TaskStatus.IDLE,
  },
  GET_WEB3_SPACE_CREATED_EVENT: {
    status: TaskStatus.IDLE,
  },
  LINK_WEB2_AND_WEB3_SPACE: {
    status: TaskStatus.IDLE,
  },
};

// Progress state reducer using immer
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

/**
 * Computes the overall progress percentage based on the current state of tasks
 * @param tasks The current task state
 * @returns A number between 0 and 100 representing the progress percentage
 */
const computeProgress = (tasks: TaskState): number => {
  const taskList = Object.values(tasks);
  const totalTasks = taskList.length;

  if (totalTasks === 0) return 0;

  // Count completed tasks
  const completedTasks = taskList.filter(
    (task) => task.status === TaskStatus.IS_DONE,
  ).length;

  // Count in-progress tasks (contribute half a task to progress)
  const inProgressTasks =
    taskList.filter((task) => task.status === TaskStatus.IS_PENDING).length *
    0.5;

  // Calculate progress percentage
  const progress = ((completedTasks + inProgressTasks) / totalTasks) * 100;

  // Round to nearest integer and ensure it's between 0 and 100
  return Math.min(100, Math.max(0, Math.round(progress)));
};

export const useCreateSpaceOrchestrator = ({
  authToken,
  config,
}: UseCreateSpaceOrchestratorInput) => {
  const web2 = useSpaceMutationsWeb2Rsc(authToken);
  const web3 = useSpaceMutationsWeb3Rpc(config);

  // Use the progressStateReducer to manage task state
  const [taskState, dispatch] = React.useReducer(
    progressStateReducer,
    initialTaskState,
  );

  const [currentAction, setCurrentAction] = React.useState<string>();

  const startTask = React.useCallback(
    (taskName: TaskName) => {
      const currentAction = taskActionDescriptions[taskName];
      setCurrentAction(currentAction);
      dispatch({
        type: 'START_TASK',
        taskName,
        message: currentAction,
      });
    },
    [dispatch, setCurrentAction],
  );

  const completeTask = React.useCallback(
    (taskName: TaskName) => {
      if (currentAction === taskActionDescriptions[taskName]) {
        setCurrentAction(undefined);
      }
      dispatch({
        type: 'COMPLETE_TASK',
        taskName,
      });
    },
    [dispatch, setCurrentAction, currentAction],
  );

  const errorTask = React.useCallback(
    (taskName: TaskName, error: string) => {
      if (currentAction === taskActionDescriptions[taskName]) {
        setCurrentAction(undefined);
      }
      dispatch({
        type: 'SET_ERROR',
        taskName,
        message: error,
      });
    },
    [dispatch],
  );

  const resetTasks = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const { trigger: createSpace } = useSWRMutation(
    'createSpaceOrchestration',
    async (_, { arg }: { arg: z.infer<typeof schemaCreateSpace> }) => {
      // Start web2 and web3 space creation tasks
      startTask('CREATE_WEB2_SPACE');
      startTask('CREATE_WEB3_SPACE');

      const inputCreateSpaceWeb2 = schemaCreateSpaceWeb2.parse(arg);
      const inputCreateSpaceWeb3 = schemaCreateSpaceWeb3.parse(arg);

      const [web2Result, transactionHash] = await Promise.all([
        web2
          .createSpace(inputCreateSpaceWeb2)
          .then(() => completeTask('CREATE_WEB2_SPACE'))
          .catch((e) => errorTask('CREATE_WEB2_SPACE', e.message)),
        web3
          .createSpace(inputCreateSpaceWeb3)
          .then(() => completeTask('CREATE_WEB3_SPACE'))
          .catch((e) => errorTask('CREATE_WEB3_SPACE', e.message)),
      ]);

      return { web2Result, transactionHash };
    },
  );

  const { data: updatedWeb2Space } = useSWR(
    web2.createdSpace?.slug && web3.createdSpace?.spaceId
      ? [
          web2.createdSpace.slug,
          web3.createdSpace.spaceId,
          'linkingWeb2AndWeb3Space',
        ]
      : null,
    async ([slug, web3SpaceId]) => {
      try {
        // Start linking web2 and web3 spaces
        startTask('LINK_WEB2_AND_WEB3_SPACE');

        const result = await web2.updateSpaceBySlug({
          slug,
          web3SpaceId: Number(web3SpaceId),
        });

        // Complete linking task
        completeTask('LINK_WEB2_AND_WEB3_SPACE');

        return result;
      } catch (error) {
        // Handle errors in linking
        if (error instanceof Error) {
          errorTask('LINK_WEB2_AND_WEB3_SPACE', error.message);
        }
        throw error;
      }
    },
  );

  const progress = computeProgress(taskState);
  const errors = React.useMemo(() => {
    return [
      web2.errorCreateSpaceMutation,
      web2.errorUpdateSpaceBySlugMutation,
      web3.errorCreateSpace,
      web3.errorWaitSpaceFromTransaction,
    ].filter(Boolean);
  }, [
    web2.errorCreateSpaceMutation,
    web2.errorUpdateSpaceBySlugMutation,
    web3.errorCreateSpace,
    web3.errorWaitSpaceFromTransaction,
  ]);

  const reset = React.useCallback(() => {
    resetTasks();
    web2.resetCreateSpaceMutation();
    web2.resetUpdateSpaceBySlugMutation();
    web3.resetCreateSpaceMutation();
  }, []);

  return {
    reset,
    createSpace,
    space: {
      ...updatedWeb2Space,
      ...web3.createdSpace,
    },
    taskState,
    currentAction,
    progress,
    isPending: progress > 0 && progress < 100,
    isError: errors.length > 0,
    isLoading: !authToken,
    errors,
  };
};
