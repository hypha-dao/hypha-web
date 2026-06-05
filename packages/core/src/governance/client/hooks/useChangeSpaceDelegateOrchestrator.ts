'use client';

import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { z } from 'zod';
import { produce } from 'immer';

import { useChangeSpaceDelegateWeb3Rpc } from './useChangeSpaceDelegateMutations.web3.rsc';
import { useAgreementFileUploads } from './useAgreementFileUploads';
import { useAgreementMutationsWeb2Rsc } from './useAgreementMutations.web2.rsc';
import {
  schemaChangeSpaceDelegate,
  schemaCreateAgreementFiles,
  schemaCreateAgreementWeb2,
  Space,
} from '@hypha-platform/core/client';
import { Config } from '@wagmi/core';

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

const computeProgress = (tasks: TaskState, includeWeb3: boolean): number => {
  const all = Object.entries(tasks)
    .filter(([task]) => includeWeb3 || task !== 'CREATE_WEB3_AGREEMENT')
    .map(([, value]) => value);
  if (all.length === 0) return 0;
  const done = all.filter((t) => t.status === TaskStatus.IS_DONE).length;
  const pending = all.filter((t) => t.status === TaskStatus.IS_PENDING).length;
  return Math.round(((done + pending * 0.5) / all.length) * 100);
};

type ChangeSpaceDelegateArg = z.infer<typeof schemaChangeSpaceDelegate> & {
  member: string;
  space: string;
  web3SpaceId: number;
};

export const useChangeSpaceDelegateOrchestrator = ({
  authToken,
  config,
  spaces,
}: {
  authToken?: string | null;
  config?: Config;
  spaces?: Space[];
}) => {
  const web2 = useAgreementMutationsWeb2Rsc(authToken);
  const web3 = useChangeSpaceDelegateWeb3Rpc({
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
  const taskStateRef = useRef(taskState);
  useEffect(() => {
    taskStateRef.current = taskState;
  }, [taskState]);
  const [currentTask, setCurrentTask] = useState<TaskName | null>(null);

  const progress = computeProgress(taskState, Boolean(config));

  const startTask = useCallback((taskName: TaskName) => {
    setCurrentTask(taskName);
    dispatch({ type: 'START_TASK', taskName });
  }, []);

  const completeTask = useCallback(
    (taskName: TaskName) => {
      if (currentTask === taskName) setCurrentTask(null);
      dispatch({ type: 'COMPLETE_TASK', taskName });
    },
    [currentTask],
  );

  const errorTask = useCallback(
    (taskName: TaskName, error: string) => {
      if (currentTask === taskName) setCurrentTask(null);
      dispatch({ type: 'SET_ERROR', taskName, message: error });
    },
    [currentTask],
  );

  const resetTasks = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const { trigger: changeSpaceDelegateAction } = useSWRMutation(
    'changeSpaceDelegateOrchestration',
    async (_: string, { arg }: { arg: ChangeSpaceDelegateArg }) => {
      let web2Slug: string | undefined;
      try {
        startTask('CREATE_WEB2_AGREEMENT');
        const inputWeb2 = schemaCreateAgreementWeb2.parse({
          ...arg,
          spaceId: arg.spaceId,
        });
        const createdAgreement = await web2.createAgreement(inputWeb2);
        completeTask('CREATE_WEB2_AGREEMENT');

        web2Slug = createdAgreement?.slug ?? undefined;

        const space = spaces?.find(
          (s) => s.address?.toLowerCase() === arg.space.toLowerCase(),
        );

        if (config) {
          if (space?.web3SpaceId == null) {
            throw new Error(
              'Selected governance space not found or missing web3SpaceId',
            );
          }
          startTask('CREATE_WEB3_AGREEMENT');
          await web3.changeSpaceDelegate({
            space: space.web3SpaceId,
            member: arg.member,
            spaceId: arg.web3SpaceId,
          });
          completeTask('CREATE_WEB3_AGREEMENT');
        }

        const files = schemaCreateAgreementFiles.parse(arg);
        startTask('UPLOAD_FILES');
        if (files.attachments?.length || files.leadImage) {
          await agreementFiles.upload(files, web2Slug);
        }
        completeTask('UPLOAD_FILES');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong';
        for (const taskName of Object.keys(
          taskStateRef.current,
        ) as TaskName[]) {
          if (taskStateRef.current[taskName].status === TaskStatus.IS_PENDING) {
            errorTask(taskName, message);
          }
        }
        setCurrentTask(null);
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
      (!config || web3.changeDelegateData?.proposalId != null)
      ? [
          web2.createdAgreement.slug,
          web3.changeDelegateData?.proposalId,
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

  const taskErrorMessages = useMemo(
    () =>
      (
        Object.values(taskState) as Array<{
          status: TaskStatus;
          message?: string;
        }>
      )
        .filter((t) => t.status === TaskStatus.ERROR && t.message)
        .map((t) => t.message as string),
    [taskState],
  );

  const hasTaskFailure = useMemo(
    () =>
      (Object.values(taskState) as Array<{ status: TaskStatus }>).some(
        (t) => t.status === TaskStatus.ERROR,
      ),
    [taskState],
  );

  const hasTaskPending = useMemo(
    () =>
      (Object.values(taskState) as Array<{ status: TaskStatus }>).some(
        (t) => t.status === TaskStatus.IS_PENDING,
      ),
    [taskState],
  );

  const errors = useMemo(
    () =>
      [
        web2.errorCreateAgreementMutation,
        web3.changeDelegateError,
        web3.errorWaitChangeDelegateFromTx,
        ...taskErrorMessages,
      ].filter(Boolean),
    [web2, web3, taskErrorMessages],
  );

  const reset = useCallback(() => {
    resetTasks();
    web2.resetCreateAgreementMutation();
    web3.resetChangeSpaceDelegateMutation();
  }, [resetTasks, web2, web3]);

  return {
    reset,
    changeSpaceDelegateAction,
    agreement: {
      ...web2.createdAgreement,
      ...web3.changeDelegateData,
      ...updatedWeb2Agreement,
    },
    taskState,
    /** i18n: map with AgreementFlow.changeSpaceDelegateProgress */
    currentTask,
    progress,
    isPending:
      !hasTaskFailure && (hasTaskPending || (progress > 0 && progress < 100)),
    isError: errors.length > 0 || hasTaskFailure,
    errors,
  };
};
