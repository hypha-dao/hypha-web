'use client';

import React, { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { z } from 'zod';
import { produce } from 'immer';

import {
  schemaCreateAgreement,
  schemaCreateAgreementWeb2,
  schemaCreateAgreementFiles,
} from '../../validation';

import { useAgreementFileUploads } from './useAgreementFileUploads';
import { useAgreementMutationsWeb2Rsc } from './useAgreementMutations.web2.rsc';

type CreateSpaceTokenPurchaseArg = z.infer<typeof schemaCreateAgreement> & {
  tokenAddress: string;
  activatePurchase: boolean;
  purchasePrice?: number;
  purchaseCurrency?: string;
  tokensAvailableForPurchase?: number;
  web3SpaceId?: number;
};

type TaskName =
  | 'CREATE_WEB2_AGREEMENT'
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
  CREATE_WEB2_AGREEMENT: 'Creating agreement...',
  UPLOAD_FILES: 'Uploading files...',
  LINK_WEB2_AND_WEB3_AGREEMENT: 'Linking Web2 and Web3 agreements',
};

type ProgressAction =
  | { type: 'START_TASK'; taskName: TaskName; message?: string }
  | { type: 'COMPLETE_TASK'; taskName: TaskName; message?: string }
  | { type: 'SET_ERROR'; taskName: TaskName; message: string }
  | { type: 'RESET' };

const initialTaskState: TaskState = {
  CREATE_WEB2_AGREEMENT: { status: TaskStatus.IDLE },
  UPLOAD_FILES: { status: TaskStatus.IDLE },
  LINK_WEB2_AND_WEB3_AGREEMENT: { status: TaskStatus.IDLE },
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

export const useSpaceTokenPurchaseOrchestrator = ({
  authToken,
}: {
  authToken?: string | null;
}) => {
  const web2 = useAgreementMutationsWeb2Rsc(authToken);
  const agreementFiles = useAgreementFileUploads(
    authToken,
    (uploadedFiles, slug) => {
      web2.updateAgreementBySlug({
        slug: slug ?? '',
        attachments: uploadedFiles?.attachments,
        leadImage: uploadedFiles?.leadImage,
      });
    },
  );

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

  const { trigger: createSpaceTokenPurchase } = useSWRMutation(
    'createSpaceTokenPurchaseOrchestration',
    async (_: string, { arg }: { arg: CreateSpaceTokenPurchaseArg }) => {
      startTask('CREATE_WEB2_AGREEMENT');
      const inputWeb2 = schemaCreateAgreementWeb2.parse({
        ...arg,
        label: 'Token Purchase',
      });
      const createdAgreement = await web2.createAgreement(inputWeb2);
      completeTask('CREATE_WEB2_AGREEMENT');

      const web2Slug = createdAgreement?.slug ?? web2.createdAgreement?.slug;

      try {
        const files = schemaCreateAgreementFiles.parse(arg);
        startTask('UPLOAD_FILES');
        if (files.attachments?.length || files.leadImage) {
          await agreementFiles.upload(files, web2Slug);
        }
        completeTask('UPLOAD_FILES');
      } catch (err) {
        if (web2Slug) {
          await web2.deleteAgreementBySlug({ slug: web2Slug });
        }
        throw err;
      }
    },
  );

  const { data: updatedWeb2Agreement } = useSWR(
    web2.createdAgreement?.slug &&
      taskState.UPLOAD_FILES.status === TaskStatus.IS_DONE
      ? [web2.createdAgreement.slug, 'linkingSpaceTokenPurchase']
      : null,
    async ([slug]) => {
      try {
        startTask('LINK_WEB2_AND_WEB3_AGREEMENT');
        const result = await web2.updateAgreementBySlug({ slug });
        completeTask('LINK_WEB2_AND_WEB3_AGREEMENT');
        return result;
      } catch (error) {
        if (error instanceof Error) {
          errorTask('LINK_WEB2_AND_WEB3_AGREEMENT', error.message);
        }
        throw error;
      }
    },
    {
      revalidateOnMount: true,
      shouldRetryOnError: false,
    },
  );

  const errors = useMemo(
    () => [web2.errorCreateAgreementMutation].filter(Boolean),
    [web2],
  );

  const reset = useCallback(() => {
    resetTasks();
    web2.resetCreateAgreementMutation();
  }, [resetTasks, web2]);

  return {
    reset,
    createSpaceTokenPurchase,
    agreement: {
      ...web2.createdAgreement,
      ...updatedWeb2Agreement,
    },
    taskState,
    currentAction,
    progress,
    isPending: progress > 0 && progress < 100,
    isError: errors.length > 0,
    errors,
  };
};
