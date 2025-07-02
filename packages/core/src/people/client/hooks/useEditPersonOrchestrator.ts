'use client';

import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
import { z } from 'zod';
import { schemaEditPersonWeb2, editPersonFiles } from '@core/people/validation';
import { usePersonFileUploads } from './usePersonFileUploads';
import { usePersonMutationsWeb2Rsc } from './usePersonMutationsWeb2Rsc';
import { produce } from 'immer';
import React, { useCallback } from 'react';

interface UseEditPersonOrchestratorInput {
  authToken?: string | null;
}

export type TaskName = 'UPDATE_WEB2_PERSON' | 'UPLOAD_FILES';

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
  UPDATE_WEB2_PERSON: 'Editing person...',
  UPLOAD_FILES: 'Uploading Person Images...',
};

export type ProgressAction =
  | { type: 'START_TASK'; taskName: TaskName; message?: string }
  | { type: 'COMPLETE_TASK'; taskName: TaskName; message?: string }
  | { type: 'SET_ERROR'; taskName: TaskName; message: string }
  | { type: 'RESET' };

const initialTaskState: TaskState = {
  UPDATE_WEB2_PERSON: {
    status: TaskStatus.IDLE,
  },
  UPLOAD_FILES: {
    status: TaskStatus.IDLE,
  },
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

export const useEditPersonOrchestrator = ({
  authToken,
}: UseEditPersonOrchestratorInput) => {
  const personFiles = usePersonFileUploads(authToken);
  const web2 = usePersonMutationsWeb2Rsc(authToken);

  // Use the progressStateReducer to manage task state
  const [taskState, dispatch] = React.useReducer(
    progressStateReducer,
    initialTaskState,
  );

  const progress = computeProgress(taskState);

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
    [dispatch, currentAction, setCurrentAction],
  );

  const resetTasks = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const { trigger: editPerson } = useSWRMutation(
    'editPersonOrchestration',
    async (_, { arg }: { arg: z.infer<typeof schemaEditPersonWeb2> }) => {
      startTask('UPDATE_WEB2_PERSON');
      const inputEditPersonWeb2 = schemaEditPersonWeb2.parse(arg);
      await web2.editPerson(inputEditPersonWeb2);
      const inputEditPersonFiles = editPersonFiles.parse(arg);

      const hasFilesToUpload =
        inputEditPersonFiles.avatarUrl instanceof File ||
        inputEditPersonFiles.leadImageUrl instanceof File ||
        (typeof inputEditPersonFiles.avatarUrl === 'string' &&
          inputEditPersonFiles.avatarUrl !== '') ||
        (typeof inputEditPersonFiles.leadImageUrl === 'string' &&
          inputEditPersonFiles.leadImageUrl !== '');

      if (hasFilesToUpload) {
        startTask('UPLOAD_FILES');
        await personFiles.upload(inputEditPersonFiles);
        completeTask('UPLOAD_FILES');
      }

      completeTask('UPDATE_WEB2_PERSON');
    },
  );

  const { data: updatedWeb2Person } = useSWR(
    web2.editedPerson?.id
      ? [web2.editedPerson.id, 'searchingWeb2Person']
      : null,
    async ([id]) => {
      try {
        const currentFiles = personFiles.files;

        const hasFilesToUpdate =
          currentFiles &&
          ((currentFiles.avatarUrl !== undefined &&
            currentFiles.avatarUrl !== '') ||
            (currentFiles.leadImageUrl !== undefined &&
              currentFiles.leadImageUrl !== ''));

        if (hasFilesToUpdate) {
          startTask('UPLOAD_FILES');
          const result = await web2.editPerson({
            id,
            ...currentFiles,
          });
          completeTask('UPLOAD_FILES');
          return result;
        }

        return web2.editedPerson;
      } catch (error) {
        if (error instanceof Error) {
          errorTask('UPLOAD_FILES', error.message);
        }
        throw error;
      }
    },
  );

  const errors = React.useMemo(() => {
    return [web2.errorEditPersonMutation].filter(Boolean);
  }, [web2.errorEditPersonMutation]);

  const reset = React.useCallback(() => {
    resetTasks();
    web2.resetEditPersonMutation();
  }, [resetTasks, web2.resetEditPersonMutation]);

  return {
    reset,
    editPerson,
    person: {
      ...updatedWeb2Person,
    },
    isEditing: web2.isEditingPerson,
    taskState,
    currentAction,
    progress,
    isPending: progress > 0 && progress < 100,
    isError: errors.length > 0,
    errors,
  };
};
