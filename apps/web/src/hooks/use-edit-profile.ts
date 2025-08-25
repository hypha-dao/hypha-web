'use client';

import { useCallback, useReducer, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import {
  schemaEditPerson,
  PersonFiles,
  useJwt,
} from '@hypha-platform/core/client';
import { usePeopleFileUploads } from './use-people-file-uploads';
import { useAuthHeader } from './use-auth-header';
import { produce } from 'immer';

export enum TaskStatus {
  IDLE = 'idle',
  IS_PENDING = 'isPending',
  IS_DONE = 'isDone',
  ERROR = 'error',
}

type TaskName = 'EDIT_PROFILE' | 'CONFIRM_CHANGES';

type TaskState = {
  [K in TaskName]: {
    status: TaskStatus;
    message?: string;
  };
};

const taskDescriptions: Record<TaskName, string> = {
  EDIT_PROFILE: 'Editing profile...',
  CONFIRM_CHANGES:
    'Your changes have been saved and will appear on your profile shortly.',
};

type ProgressAction =
  | { type: 'START_TASK'; taskName: TaskName }
  | { type: 'COMPLETE_TASK'; taskName: TaskName }
  | { type: 'SET_ERROR'; taskName: TaskName; message: string }
  | { type: 'RESET' };

const initialTaskState: TaskState = {
  EDIT_PROFILE: { status: TaskStatus.IDLE },
  CONFIRM_CHANGES: { status: TaskStatus.IDLE },
};

const reducer = (state: TaskState, action: ProgressAction): TaskState =>
  produce(state, (draft) => {
    switch (action.type) {
      case 'START_TASK':
        draft[action.taskName].status = TaskStatus.IS_PENDING;
        draft[action.taskName].message = taskDescriptions[action.taskName];
        break;
      case 'COMPLETE_TASK':
        draft[action.taskName].status = TaskStatus.IS_DONE;
        draft[action.taskName].message = taskDescriptions[action.taskName];
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
  const taskList = Object.values(tasks);
  const total = taskList.length;
  const done = taskList.filter((t) => t.status === TaskStatus.IS_DONE).length;
  const pending =
    taskList.filter((t) => t.status === TaskStatus.IS_PENDING).length * 0.5;

  return Math.round(((done + pending) / total) * 100);
};

export const useEditProfile = (endpoint = '/api/v1/people/edit-profile') => {
  const { jwt } = useJwt();
  const { headers } = useAuthHeader();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const { upload } = usePeopleFileUploads({ authToken: jwt });

  const [taskState, dispatch] = useReducer(reducer, initialTaskState);
  const [lastStartedTask, setLastStartedTask] = useState<TaskName | null>(null);

  const editProfile = useCallback(
    async (data: z.infer<typeof schemaEditPerson>) => {
      if (!headers) {
        throw new Error('No auth headers available');
      }

      setError(null);
      dispatch({ type: 'RESET' });

      dispatch({ type: 'START_TASK', taskName: 'EDIT_PROFILE' });
      setLastStartedTask('EDIT_PROFILE');

      try {
        let uploadedFiles: Partial<PersonFiles> = {
          avatarUrl: undefined,
          leadImageUrl: undefined,
        };

        const filesToUpload: Partial<PersonFiles> = {
          avatarUrl: data.avatarUrl,
          leadImageUrl: data.leadImageUrl,
        };

        if (filesToUpload.avatarUrl || filesToUpload.leadImageUrl) {
          uploadedFiles = await upload(filesToUpload);
        }

        const payload = {
          ...data,
          avatarUrl: uploadedFiles.avatarUrl,
          leadImageUrl: uploadedFiles.leadImageUrl,
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update profile');
        }

        await response.json();

        dispatch({ type: 'COMPLETE_TASK', taskName: 'EDIT_PROFILE' });

        await new Promise((res) => setTimeout(res, 600));

        dispatch({ type: 'START_TASK', taskName: 'CONFIRM_CHANGES' });
        setLastStartedTask('CONFIRM_CHANGES');

        await new Promise((res) => setTimeout(res, 1000));
        dispatch({ type: 'COMPLETE_TASK', taskName: 'CONFIRM_CHANGES' });

        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown profile update error';
        console.error('Profile update error:', message);
        dispatch({ type: 'SET_ERROR', taskName: 'EDIT_PROFILE', message });
        setError(message);
        throw err;
      }
    },
    [endpoint, headers, router, upload],
  );

  const progress = computeProgress(taskState);
  const isPending = progress > 0 && progress < 100;
  const isError = Object.values(taskState).some(
    (t) => t.status === TaskStatus.ERROR,
  );

  const currentAction =
    lastStartedTask && taskState[lastStartedTask]
      ? taskState[lastStartedTask].message
      : undefined;

  const reset = () => {
    dispatch({ type: 'RESET' });
    setError(null);
    setLastStartedTask(null);
  };

  return {
    editProfile,
    isEditing: isPending,
    error,
    progress,
    currentAction,
    isError,
    reset,
  };
};
