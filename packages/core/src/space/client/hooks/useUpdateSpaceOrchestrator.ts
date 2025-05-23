'use client';

import { useCallback, useReducer, useMemo, useState } from 'react';
import useSWRMutation from 'swr/mutation';
import invariant from 'tiny-invariant';
import { produce } from 'immer';
import { z } from 'zod';

import { useSpaceFileUploads } from './useSpaceFileUploads';
import { useSpaceMutationsWeb2Rsc } from './useSpaceMutations.web2.rsc';
import {
  schemaCreateSpaceFiles,
  schemaUpdateSpace,
} from '@core/space/validation';

type UseUpdateSpaceInput = {
  authToken?: string | null;
};

export type TaskName = 'UPDATE_WEB2_SPACE' | 'UPLOAD_FILES';

export enum TaskStatus {
  IDLE = 'idle',
  IS_PENDING = 'isPending',
  IS_DONE = 'isDone',
  ERROR = 'error',
}

type TaskState = {
  [K in TaskName]: {
    status: TaskStatus;
    message?: string;
  };
};

type ProgressAction =
  | { type: 'START_TASK'; taskName: TaskName; message?: string }
  | { type: 'COMPLETE_TASK'; taskName: TaskName; message?: string }
  | { type: 'SET_ERROR'; taskName: TaskName; message: string }
  | { type: 'RESET' };

const taskActionDescriptions: Record<TaskName, string> = {
  UPDATE_WEB2_SPACE: 'Updating Web2 space...',
  UPLOAD_FILES: 'Uploading space files...',
};

const initialTaskState: TaskState = {
  UPDATE_WEB2_SPACE: { status: TaskStatus.IDLE },
  UPLOAD_FILES: { status: TaskStatus.IDLE },
};

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
  const total = Object.keys(tasks).length;
  if (total === 0) return 0;

  const done = Object.values(tasks).filter(
    (t) => t.status === TaskStatus.IS_DONE,
  ).length;
  const pending = Object.values(tasks).filter(
    (t) => t.status === TaskStatus.IS_PENDING,
  ).length;

  return Math.min(100, Math.round(((done + pending * 0.5) / total) * 100));
};

export const useUpdateSpaceOrchestrator = ({
  authToken,
}: UseUpdateSpaceInput) => {
  const web2 = useSpaceMutationsWeb2Rsc(authToken);
  const files = useSpaceFileUploads(authToken);

  const [taskState, dispatch] = useReducer(
    progressStateReducer,
    initialTaskState,
  );
  const [currentAction, setCurrentAction] = useState<string>();

  const progress = computeProgress(taskState);

  const startTask = useCallback((task: TaskName) => {
    const message = taskActionDescriptions[task];
    setCurrentAction(message);
    dispatch({ type: 'START_TASK', taskName: task, message });
  }, []);

  const completeTask = useCallback(
    (task: TaskName) => {
      if (currentAction === taskActionDescriptions[task])
        setCurrentAction(undefined);
      dispatch({ type: 'COMPLETE_TASK', taskName: task });
    },
    [currentAction],
  );

  const errorTask = useCallback(
    (task: TaskName, message: string) => {
      if (currentAction === taskActionDescriptions[task])
        setCurrentAction(undefined);
      dispatch({ type: 'SET_ERROR', taskName: task, message });
    },
    [currentAction],
  );

  const resetTasks = useCallback(() => dispatch({ type: 'RESET' }), []);

  const { trigger: updateSpace, isMutating } = useSWRMutation(
    'updateSpaceMutation',
    async (_, { arg }: { arg: z.infer<typeof schemaUpdateSpace> }) => {
      try {
        console.debug('updateSpaceMutation called with arg:', arg);
        const { slug } = arg;
        invariant(slug, 'slug is required');

        startTask('UPLOAD_FILES');
        const filesInput = schemaCreateSpaceFiles.parse(arg);
        const urls = await files.upload(filesInput);
        completeTask('UPLOAD_FILES');

        startTask('UPDATE_WEB2_SPACE');
        const updateInput = schemaUpdateSpace.parse(arg);
        const result = await web2.updateSpaceBySlug({
          ...updateInput,
          ...urls,
          slug,
        });

        console.debug('updateSpaceBySlug result:', result);
        completeTask('UPDATE_WEB2_SPACE');

        return result;
      } catch (error) {
        console.error('updateSpaceMutation error:', error);
        if (error instanceof Error) {
          if (taskState.UPLOAD_FILES?.status === TaskStatus.IS_PENDING) {
            errorTask('UPLOAD_FILES', error.message);
          }
          if (taskState.UPDATE_WEB2_SPACE?.status === TaskStatus.IS_PENDING) {
            errorTask('UPDATE_WEB2_SPACE', error.message);
          }
        }
        throw error;
      }
    },
  );

  const errors = useMemo(() => {
    return [web2.errorUpdateSpaceBySlugMutation, files.error].filter(Boolean);
  }, [web2.errorUpdateSpaceBySlugMutation, files.error]);

  const reset = useCallback(() => {
    resetTasks();
    web2.resetUpdateSpaceBySlugMutation();
    files.reset();
  }, [resetTasks, web2, files]);

  return {
    updateSpace,
    isMutating,
    taskState,
    currentAction,
    progress,
    isPending: progress > 0 && progress < 100,
    isError: errors.length > 0,
    errors,
    reset,
  };
};
