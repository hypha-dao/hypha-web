'use client';

import { produce } from 'immer';
import { useCoherenceMutationsWeb2Rsc } from './useCoherenceMutations.web2.rsc';
import { Config } from 'wagmi';
import React from 'react';
import useSWRMutation from 'swr/mutation';
import {
  schemaCreateCoherence,
  schemaCreateCoherenceWeb2,
} from '../../validation';
import { z } from 'zod';

type UseCreateCoherenceOrchestratorInput = {
  authToken?: string | null;
  config?: Config;
};

type TaskName = 'CREATE_WEB2_SIGNAL';
// | 'CREATE_WEB3_SIGNAL'
// | 'UPLOAD_FILES'
// | 'LINK_WEB2_AND_WEB3_SIGNAL';

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
  CREATE_WEB2_SIGNAL: 'Creating Web2 signal...',
  // CREATE_WEB3_SIGNAL: 'Creating Web3 signal...',
  // UPLOAD_FILES: 'Uploading Signal Files...',
  // LINK_WEB2_AND_WEB3_SIGNAL: 'Linking Web2 and Web3 signal',
};

type ProgressAction =
  | { type: 'START_TASK'; taskName: TaskName; message?: string }
  | { type: 'COMPLETE_TASK'; taskName: TaskName; message?: string }
  | { type: 'SET_ERROR'; taskName: TaskName; message: string }
  | { type: 'RESET' };

const initialTaskState: TaskState = {
  CREATE_WEB2_SIGNAL: { status: TaskStatus.IDLE },
  // CREATE_WEB3_SIGNAL: { status: TaskStatus.IDLE },
  // UPLOAD_FILES: { status: TaskStatus.IDLE },
  // LINK_WEB2_AND_WEB3_SIGNAL: { status: TaskStatus.IDLE },
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

export const useCreateCoherenceOrchestrator = ({
  authToken,
  config,
}: UseCreateCoherenceOrchestratorInput) => {
  const web2 = useCoherenceMutationsWeb2Rsc(authToken);

  const [taskState, dispatch] = React.useReducer(
    progressStateReducer,
    initialTaskState,
  );
  const progress = computeProgress(taskState);
  const [currentAction, setCurrentAction] = React.useState<string>();

  const startTask = React.useCallback((taskName: TaskName) => {
    const action = taskActionDescriptions[taskName];
    setCurrentAction(action);
    dispatch({ type: 'START_TASK', taskName, message: action });
  }, []);

  const completeTask = React.useCallback(
    (taskName: TaskName) => {
      if (currentAction === taskActionDescriptions[taskName])
        setCurrentAction(undefined);
      dispatch({ type: 'COMPLETE_TASK', taskName });
    },
    [currentAction],
  );

  const errorTask = React.useCallback(
    (taskName: TaskName, error: string) => {
      if (currentAction === taskActionDescriptions[taskName])
        setCurrentAction(undefined);
      dispatch({ type: 'SET_ERROR', taskName, message: error });
    },
    [currentAction],
  );

  const resetTasks = React.useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const { trigger: createCoherence } = useSWRMutation(
    'createCoherenceOrchestration',
    async (_, { arg }: { arg: z.infer<typeof schemaCreateCoherence> }) => {
      startTask('CREATE_WEB2_SIGNAL');
      const inputCreateCoherenceWeb2 = schemaCreateCoherenceWeb2.parse(arg);
      const createdCoherence = await web2.createCoherence(
        inputCreateCoherenceWeb2,
      );
      completeTask('CREATE_WEB2_SIGNAL');

      const web2Slug = createdCoherence?.slug ?? web2.createdCoherence?.slug;
      try {
        if (config) {
          // startTask('CREATE_WEB3_SIGNAL');
          // completeTask('CREATE_WEB3_SIGNAL');
        }

        // startTask('UPLOAD_FILES');
        // completeTask('UPLOAD_FILES');
      } catch (err) {
        if (web2Slug) {
          await web2.deleteCoherenceBySlug({ slug: web2Slug });
        }
        throw err;
      }
    },
  );

  const errors = React.useMemo(() => {
    return [web2.errorCreateCoherenceMutation].filter(Boolean);
  }, [web2.errorCreateCoherenceMutation]);

  const reset = React.useCallback(() => {
    resetTasks();
    web2.resetCreateCoherenceMutation();
  }, [resetTasks, web2]);

  return {
    reset,
    createCoherence,
    coherence: {
      ...web2.createdCoherence,
    },
    taskState,
    currentAction,
    progress,
    isPending: progress > 0 && progress < 100,
    isError: errors.length > 0,
    errors,
  };
};
