'use client';

import React, { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { Config } from '@wagmi/core';
import { z } from 'zod';
import { produce } from 'immer';

import {
  schemaCreateAgreement,
  schemaCreateAgreementWeb2,
  schemaCreateAgreementFiles,
} from '../../validation';

import { useAgreementMutationsWeb2Rsc } from './useAgreementMutations.web2.rsc';
import {
  useAirdropMutationsWeb3Rpc,
  AirdropAllocation,
} from './useAirdropMutations.web3.rpc';
import { useAgreementFileUploads } from './useAgreementFileUploads';

type CreateAirdropArg = z.infer<typeof schemaCreateAgreement> & {
  airdrop: AirdropAllocation[];
  web3SpaceId?: number;
};

type TaskName =
  | 'CREATE_WEB2_AGREEMENT'
  | 'CREATE_WEB3_AGREEMENT'
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

type ProgressAction =
  | { type: 'START_TASK'; taskName: TaskName; message?: string }
  | { type: 'COMPLETE_TASK'; taskName: TaskName; message?: string }
  | { type: 'SET_ERROR'; taskName: TaskName; message: string }
  | { type: 'RESET' };

const initialTaskState: TaskState = {
  CREATE_WEB2_AGREEMENT: { status: TaskStatus.IDLE },
  CREATE_WEB3_AGREEMENT: { status: TaskStatus.IDLE },
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

export const useCreateAirdropOrchestrator = ({
  authToken,
  config,
}: {
  authToken?: string | null;
  config?: Config;
}) => {
  const web2 = useAgreementMutationsWeb2Rsc(authToken);
  const web3 = useAirdropMutationsWeb3Rpc({
    proposalSlug: web2.createdAgreement?.slug,
  });
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
  const [currentTask, setCurrentTask] = React.useState<TaskName | null>(null);
  const activeTaskRef = React.useRef<TaskName | null>(null);

  const startTask = useCallback((taskName: TaskName) => {
    activeTaskRef.current = taskName;
    setCurrentTask(taskName);
    dispatch({ type: 'START_TASK', taskName });
  }, []);

  const completeTask = useCallback((taskName: TaskName) => {
    if (activeTaskRef.current === taskName) activeTaskRef.current = null;
    setCurrentTask((current) => (current === taskName ? null : current));
    dispatch({ type: 'COMPLETE_TASK', taskName });
  }, []);

  const errorTask = useCallback((taskName: TaskName, error: string) => {
    if (activeTaskRef.current === taskName) activeTaskRef.current = null;
    setCurrentTask((current) => (current === taskName ? null : current));
    dispatch({ type: 'SET_ERROR', taskName, message: error });
  }, []);

  const resetTasks = useCallback(() => {
    activeTaskRef.current = null;
    setCurrentTask(null);
    dispatch({ type: 'RESET' });
  }, []);

  const { trigger: createAirdrop } = useSWRMutation(
    'createAirdropOrchestration',
    async (_: string, { arg }: { arg: CreateAirdropArg }) => {
      startTask('CREATE_WEB2_AGREEMENT');
      const inputWeb2 = schemaCreateAgreementWeb2.parse(arg);
      const createdAgreement = await web2.createAgreement(inputWeb2);
      completeTask('CREATE_WEB2_AGREEMENT');

      const web2Slug = createdAgreement?.slug ?? web2.createdAgreement?.slug;
      const web3SpaceId = arg.web3SpaceId;

      try {
        if (config && typeof web3SpaceId === 'number') {
          startTask('CREATE_WEB3_AGREEMENT');
          await web3.createAirdrop({
            spaceId: web3SpaceId,
            airdrop: arg.airdrop,
          });
          completeTask('CREATE_WEB3_AGREEMENT');
        } else {
          // Web3 is intentionally skipped (Web2-only flow); mark the task as
          // done so progress can still reach 100% and linking can proceed.
          completeTask('CREATE_WEB3_AGREEMENT');
        }
        const files = schemaCreateAgreementFiles.parse(arg);
        if (files.attachments?.length || files.leadImage) {
          startTask('UPLOAD_FILES');
          await agreementFiles.upload(files, web2Slug);
          completeTask('UPLOAD_FILES');
        } else {
          startTask('UPLOAD_FILES');
          completeTask('UPLOAD_FILES');
        }
      } catch (err) {
        // Mark the in-flight task as errored so progress/status reflects it.
        const activeTask = activeTaskRef.current;
        if (activeTask) {
          errorTask(
            activeTask,
            err instanceof Error ? err.message : String(err),
          );
        }
        // Best-effort cleanup of the Web2 agreement; never let a cleanup
        // failure overwrite the original error.
        if (web2Slug) {
          try {
            await web2.deleteAgreementBySlug({ slug: web2Slug });
          } catch {
            // ignore cleanup failure; preserve the original error below
          }
        }
        throw err;
      }
    },
  );

  const { data: updatedWeb2Agreement } = useSWR(
    web2.createdAgreement?.slug &&
      taskState.UPLOAD_FILES.status === TaskStatus.IS_DONE &&
      (!config || taskState.CREATE_WEB3_AGREEMENT.status === TaskStatus.IS_DONE)
      ? [
          web2.createdAgreement.slug,
          web3.createdAirdrop?.proposalId,
          'linkingWeb2AndWeb3',
        ]
      : null,
    async ([slug, web3ProposalId]) => {
      try {
        startTask('LINK_WEB2_AND_WEB3_AGREEMENT');
        const result = await web2.updateAgreementBySlug({
          slug,
          web3ProposalId: web3ProposalId ? Number(web3ProposalId) : undefined,
        });
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
    () =>
      [
        web2.errorCreateAgreementMutation,
        web3.errorCreateAirdrop,
        web3.errorWaitAirdropFromTransaction,
      ].filter(Boolean),
    [web2, web3],
  );

  const reset = useCallback(() => {
    resetTasks();
    web2.resetCreateAgreementMutation();
    web3.resetCreateAirdropMutation();
  }, [resetTasks, web2, web3]);

  return {
    reset,
    createAirdrop,
    agreement: {
      ...web2.createdAgreement,
      ...web3.createdAirdrop,
      ...updatedWeb2Agreement,
    },
    taskState,
    /** i18n: map with AgreementFlow.createAirdropProgress */
    currentTask,
    progress,
    isPending: progress > 0 && progress < 100,
    isError: errors.length > 0,
    errors,
  };
};
