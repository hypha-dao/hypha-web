'use client';

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
import { useCreateEvent } from '../../../events';
import { useMe } from '../../../people';
import { publicClient } from '@hypha-platform/core/client';
import { getSpaceFromLogs } from '../web3/dao-space-factory/get-space-created-event';
import { useImageUpload } from '../../../assets/client';
import { CreateSpaceInput } from '../../types';

type UseCreateSpaceOrchestratorInput = {
  authToken?: string | null;
  config: Config;
};

export type TaskName =
  | 'UPLOAD_FILES'
  | 'CREATE_WEB3_SPACE'
  | 'CREATE_WEB2_SPACE';

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
  UPLOAD_FILES: 'Uploading Space Images...',
  CREATE_WEB3_SPACE: 'Creating Web3 space...',
  CREATE_WEB2_SPACE: 'Creating Web2 space...',
};

export type ProgressAction =
  | { type: 'START_TASK'; taskName: TaskName; message?: string }
  | { type: 'COMPLETE_TASK'; taskName: TaskName; message?: string }
  | { type: 'SET_ERROR'; taskName: TaskName; message: string }
  | { type: 'RESET' };

const initialTaskState: TaskState = {
  UPLOAD_FILES: { status: TaskStatus.IDLE },
  CREATE_WEB3_SPACE: { status: TaskStatus.IDLE },
  CREATE_WEB2_SPACE: { status: TaskStatus.IDLE },
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

const computeProgress = (tasks: TaskState): number => {
  const taskList = Object.values(tasks);
  const totalTasks = taskList.length;
  if (totalTasks === 0) return 0;
  const completedTasks = taskList.filter(
    (task) => task.status === TaskStatus.IS_DONE,
  ).length;
  const inProgressTasks =
    taskList.filter((task) => task.status === TaskStatus.IS_PENDING).length *
    0.5;
  const progress = ((completedTasks + inProgressTasks) / totalTasks) * 100;
  return Math.min(100, Math.max(0, Math.round(progress)));
};

export const useCreateSpaceOrchestrator = ({
  authToken,
  config,
}: UseCreateSpaceOrchestratorInput) => {
  const { createEvent } = useCreateEvent({ authToken });
  const { person } = useMe();
  const web2 = useSpaceMutationsWeb2Rsc(authToken);
  const web3 = useSpaceMutationsWeb3Rpc();
  const { upload: uploadImage } = useImageUpload({
    authorizationToken: authToken ?? undefined,
  });

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

  const { trigger: createSpace } = useSWRMutation(
    'createSpaceOrchestration',
    async (_, { arg }: { arg: z.infer<typeof schemaCreateSpace> }) => {
      const web3SpaceId = (arg as any).web3SpaceId;
      let web3SpaceIdResult: number | undefined = undefined;
      let web3Executor: string | undefined = undefined;
      let web2SpaceId: number | undefined = undefined;
      let uploadedFileUrls: {
        logoUrl?: string;
        leadImage?: string;
      } = {};

      try {
        const logoUrl = (arg as any).logoUrl;
        const leadImage = (arg as any).leadImage;

        if (logoUrl || leadImage) {
          startTask('UPLOAD_FILES');

          const uploadPromises: Promise<void>[] = [];

          if (logoUrl instanceof File) {
            uploadPromises.push(
              uploadImage([logoUrl]).then((result) => {
                if (result?.[0]?.ufsUrl) {
                  uploadedFileUrls.logoUrl = result[0].ufsUrl;
                }
              }),
            );
          } else if (typeof logoUrl === 'string' && logoUrl) {
            uploadedFileUrls.logoUrl = logoUrl;
          }

          if (leadImage instanceof File) {
            uploadPromises.push(
              uploadImage([leadImage]).then((result) => {
                if (result?.[0]?.ufsUrl) {
                  uploadedFileUrls.leadImage = result[0].ufsUrl;
                }
              }),
            );
          } else if (typeof leadImage === 'string' && leadImage) {
            uploadedFileUrls.leadImage = leadImage;
          }

          await Promise.all(uploadPromises);
          completeTask('UPLOAD_FILES');
        } else {
          startTask('UPLOAD_FILES');
          completeTask('UPLOAD_FILES');
        }

        startTask('CREATE_WEB3_SPACE');

        const flags = (arg as any).flags ?? [];
        const isSandbox = flags.includes('sandbox');
        const isDemo = flags.includes('demo');
        const isLive = !isDemo && !isSandbox;

        let discoverability: number;
        if (isSandbox) {
          discoverability = 3;
        } else if (isDemo) {
          discoverability = 1;
        } else {
          discoverability = 0;
        }

        const access = 2;

        const inputCreateSpaceWeb3 = schemaCreateSpaceWeb3.parse({
          quorum: 50,
          unity: 80,
          votingPowerSource: 2,
          joinMethod: 2,
          exitMethod: 0,
          access,
          discoverability,
        });

        const txHash = await web3.createSpace(inputCreateSpaceWeb3);

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash as `0x${string}`,
        });

        const spaceData = getSpaceFromLogs(receipt.logs);
        if (!spaceData?.spaceId || !spaceData?.executor) {
          throw new Error(
            'Failed to extract spaceId and executor from transaction logs',
          );
        }

        web3SpaceIdResult = Number(spaceData.spaceId);
        web3Executor = spaceData.executor as string;
        completeTask('CREATE_WEB3_SPACE');

        startTask('CREATE_WEB2_SPACE');
        const inputCreateSpaceWeb2 = schemaCreateSpaceWeb2.parse({
          ...arg,
          web3SpaceId: web3SpaceIdResult,
          address: web3Executor,
        });
        const createSpaceInput: CreateSpaceInput = {
          ...inputCreateSpaceWeb2,
          logoUrl: uploadedFileUrls.logoUrl,
          leadImage: uploadedFileUrls.leadImage,
        };
        const createdSpace = await web2.createSpace(createSpaceInput);
        web2SpaceId = createdSpace?.id;

        if (person?.address && createdSpace?.id) {
          await createEvent({
            type: 'joinSpace',
            referenceEntity: 'space',
            referenceId: createdSpace.id,
            parameters: { memberAddress: person.address },
          });
        }
        completeTask('CREATE_WEB2_SPACE');
      } catch (err) {
        if (web2SpaceId && !web3SpaceIdResult) {
          try {
            const spaceToDelete = web2.createdSpace;
            if (spaceToDelete?.slug) {
              await web2.deleteSpaceBySlug({ slug: spaceToDelete.slug });
            }
          } catch (deleteError) {
            console.error('Failed to cleanup Web2 space:', deleteError);
          }
        }
        throw err;
      }
    },
  );

  const errors = React.useMemo(() => {
    return [
      web2.errorCreateSpaceMutation,
      web3.errorCreateSpace,
      web3.errorWaitSpaceFromTransaction,
    ].filter(Boolean);
  }, [
    web2.errorCreateSpaceMutation,
    web3.errorCreateSpace,
    web3.errorWaitSpaceFromTransaction,
  ]);

  const reset = useCallback(() => {
    resetTasks();
    web2.resetCreateSpaceMutation();
    web3.resetCreateSpaceMutation();
  }, [resetTasks, web2, web3]);

  return {
    reset,
    createSpace,
    space: {
      ...web2.createdSpace,
      ...web3.createdSpace,
    },
    taskState,
    currentAction,
    progress,
    isPending: progress > 0 && progress < 100,
    isError: errors.length > 0,
    errors,
  };
};
