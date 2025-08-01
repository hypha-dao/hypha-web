'use client';

import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
import { useCallback, useMemo, useReducer, useState } from 'react';
import { z } from 'zod';
import { produce } from 'immer';

import { useChangeVotingMethodMutationsWeb3Rpc } from './useChangeVotingMethodMutations.web3.rsc';
import { useAgreementFileUploads } from './useAgreementFileUploads';
import { useAgreementMutationsWeb2Rsc } from './useAgreementMutations.web2.rsc';
import {
  schemaCreateAgreementWeb2,
  schemaCreateAgreementFiles,
} from '../../validation';
import { Config } from '@wagmi/core';

export type VotingMethodType = '1m1v' | '1v1v' | '1t1v';

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

const taskActionDescriptions: Record<TaskName, string> = {
  CREATE_WEB2_AGREEMENT: 'Creating Web2 agreement...',
  CREATE_WEB3_AGREEMENT: 'Creating Web3 agreement...',
  UPLOAD_FILES: 'Uploading Files...',
  LINK_WEB2_AND_WEB3_AGREEMENT: 'Linking Web2 and Web3 agreements',
};

const initialTaskState: TaskState = {
  CREATE_WEB2_AGREEMENT: { status: TaskStatus.IDLE },
  CREATE_WEB3_AGREEMENT: { status: TaskStatus.IDLE },
  UPLOAD_FILES: { status: TaskStatus.IDLE },
  LINK_WEB2_AND_WEB3_AGREEMENT: { status: TaskStatus.IDLE },
};

type ProgressAction =
  | { type: 'START_TASK'; taskName: TaskName; message?: string }
  | { type: 'COMPLETE_TASK'; taskName: TaskName; message?: string }
  | { type: 'SET_ERROR'; taskName: TaskName; message: string }
  | { type: 'RESET' };

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
  const all = Object.values(tasks);
  const done = all.filter((t) => t.status === TaskStatus.IS_DONE).length;
  const pending = all.filter((t) => t.status === TaskStatus.IS_PENDING).length;
  return Math.round(((done + pending * 0.5) / all.length) * 100);
};

type CreateChangeVotingMethodArg = z.infer<typeof schemaCreateAgreementWeb2> & {
  web3SpaceId: number;
  members: { member: string; number: number }[];
  token: `0x${string}` | undefined;
  quorumAndUnity: { quorum: bigint; unity: bigint };
  votingMethod: VotingMethodType;
};

export const useCreateChangeVotingMethodOrchestrator = ({
  authToken,
  config,
}: {
  authToken?: string | null;
  config?: Config;
}) => {
  const web2 = useAgreementMutationsWeb2Rsc(authToken);
  const web3 = useChangeVotingMethodMutationsWeb3Rpc({
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

  const [taskState, dispatch] = useReducer(
    progressStateReducer,
    initialTaskState,
  );
  const [currentAction, setCurrentAction] = useState<string>();

  const progress = computeProgress(taskState);

  const startTask = useCallback((taskName: TaskName) => {
    const message = taskActionDescriptions[taskName];
    setCurrentAction(message);
    dispatch({ type: 'START_TASK', taskName, message });
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

  const { trigger: createChangeVotingMethod } = useSWRMutation(
    'createChangeVotingMethodOrchestration',
    async (_: string, { arg }: { arg: CreateChangeVotingMethodArg }) => {
      startTask('CREATE_WEB2_AGREEMENT');
      const inputWeb2 = schemaCreateAgreementWeb2.parse(arg);
      const createdAgreement = await web2.createAgreement(inputWeb2);
      completeTask('CREATE_WEB2_AGREEMENT');

      const web2Slug = createdAgreement?.slug;

      try {
        if (config) {
          startTask('CREATE_WEB3_AGREEMENT');
          await web3.createChangeVotingMethod({
            spaceId: arg.web3SpaceId,
            members: arg.members,
            token: arg.token,
            quorumAndUnity: arg.quorumAndUnity,
            votingMethod: arg.votingMethod,
          });
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
        if (web2Slug) {
          await web2.deleteAgreementBySlug({ slug: web2Slug });
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
          web3.changeVotingMethodData?.proposalId,
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
        web3.errorChangeVotingMethod,
        web3.errorWaitProposalFromTx,
      ].filter(Boolean),
    [web2, web3],
  );

  const reset = useCallback(() => {
    resetTasks();
    web2.resetCreateAgreementMutation();
    web3.resetChangeVotingMethod();
  }, [resetTasks, web2, web3]);

  return {
    reset,
    createChangeVotingMethod,
    agreement: {
      ...web2.createdAgreement,
      ...web3.changeVotingMethodData,
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
