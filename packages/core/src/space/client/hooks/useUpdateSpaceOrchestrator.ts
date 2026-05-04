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
} from '@hypha-platform/core/client';

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
  const files = useSpaceFileUploads(authToken, async (uploadedFiles, id) => {
    if (
      !uploadedFiles.leadImage &&
      !uploadedFiles.logoUrl &&
      !uploadedFiles.ecosystemLogoUrlLight &&
      !uploadedFiles.ecosystemLogoUrlDark
    ) {
      return;
    }
    await web2.updateSpaceById({
      id,
      ...uploadedFiles,
    });
  });

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
    async (
      _,
      {
        arg,
      }: {
        arg: {
          id: number;
          data: Omit<
            z.infer<typeof schemaUpdateSpace>,
            | 'logoUrl'
            | 'leadImage'
            | 'ecosystemLogoUrlLight'
            | 'ecosystemLogoUrlDark'
          > & {
            logoUrl?: string | File | null;
            leadImage?: string | File | null;
            ecosystemLogoUrlLight?: string | File | null;
            ecosystemLogoUrlDark?: string | File | null;
          };
        };
      },
    ) => {
      let activeTask: TaskName | null = null;
      try {
        console.debug('updateSpaceMutation called with arg:', arg);
        const { id, data } = arg;
        invariant(Number.isFinite(id) && id > 0, 'valid id is required');

        const filesInput = schemaCreateSpaceFiles.partial().parse({
          ...data,
          logoUrl: data.logoUrl ?? undefined,
          leadImage: data.leadImage ?? undefined,
          ecosystemLogoUrlLight: data.ecosystemLogoUrlLight ?? undefined,
          ecosystemLogoUrlDark: data.ecosystemLogoUrlDark ?? undefined,
        });
        if (Object.values(filesInput).some((file) => file instanceof File)) {
          activeTask = 'UPLOAD_FILES';
          startTask('UPLOAD_FILES');
          await files.upload(
            filesInput as z.infer<typeof schemaCreateSpaceFiles>,
            id,
          );
          completeTask('UPLOAD_FILES');
          activeTask = null;
        } else {
          activeTask = 'UPLOAD_FILES';
          startTask('UPLOAD_FILES');
          completeTask('UPLOAD_FILES');
          activeTask = null;
        }

        activeTask = 'UPDATE_WEB2_SPACE';
        startTask('UPDATE_WEB2_SPACE');
        const updateInput = schemaUpdateSpace.parse({
          ...data,
          logoUrl:
            typeof data.logoUrl === 'string'
              ? data.logoUrl
              : data.logoUrl === null
              ? null
              : undefined,
          leadImage:
            typeof data.leadImage === 'string'
              ? data.leadImage
              : data.leadImage === null
              ? null
              : undefined,
          ecosystemLogoUrlLight:
            typeof data.ecosystemLogoUrlLight === 'string'
              ? data.ecosystemLogoUrlLight
              : data.ecosystemLogoUrlLight === null
              ? null
              : undefined,
          ecosystemLogoUrlDark:
            typeof data.ecosystemLogoUrlDark === 'string'
              ? data.ecosystemLogoUrlDark
              : data.ecosystemLogoUrlDark === null
              ? null
              : undefined,
        });
        const result = await web2.updateSpaceById({
          ...updateInput,
          id,
        });

        console.debug('updateSpaceById result:', result);
        completeTask('UPDATE_WEB2_SPACE');
        activeTask = null;

        return result;
      } catch (error) {
        console.error('updateSpaceMutation error:', error);
        if (error instanceof Error && activeTask) {
          errorTask(activeTask, error.message);
        }
        throw error;
      }
    },
  );

  const errors = useMemo(() => {
    return [web2.errorUpdateSpaceByIdMutation, files.error].filter(Boolean);
  }, [web2.errorUpdateSpaceByIdMutation, files.error]);

  const reset = useCallback(() => {
    resetTasks();
    web2.resetUpdateSpaceByIdMutation();
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
