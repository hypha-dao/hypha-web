'use client';

import useSWR from 'swr';
import { Config } from '@wagmi/core';
import { z } from 'zod';
import { produce } from 'immer';
import React, { useCallback } from 'react';

import { useChangeSpaceTransparencySettingsMutationsWeb3Rpc } from './useChangeSpaceTransparencySettingsMutations.web3.rpc';
import useSWRMutation from 'swr/mutation';
import {
  schemaCreateAgreementWeb2,
  schemaCreateAgreementFiles,
  schemaChangeSpaceTransparencySettings,
} from '../../validation';
import { useAgreementFileUploads, useAgreementMutationsWeb2Rsc } from '.';

type UseChangeSpaceTransparencySettingsOrchestratorInput = {
  authToken?: string | null;
  config?: Config;
};

type TaskName =
  | 'CREATE_WEB2_CHANGE_SPACE_TRANSPARENCY_SETTINGS'
  | 'CREATE_WEB3_CHANGE_SPACE_TRANSPARENCY_SETTINGS'
  | 'UPLOAD_FILES'
  | 'LINK_WEB2_AND_WEB3_CHANGE_SPACE_TRANSPARENCY_SETTINGS';

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
  CREATE_WEB2_CHANGE_SPACE_TRANSPARENCY_SETTINGS:
    'Creating Web2 change space transparency settings...',
  CREATE_WEB3_CHANGE_SPACE_TRANSPARENCY_SETTINGS:
    'Creating Web3 change space transparency settings...',
  UPLOAD_FILES: 'Uploading Agreement Files...',
  LINK_WEB2_AND_WEB3_CHANGE_SPACE_TRANSPARENCY_SETTINGS:
    'Linking Web2 and Web3 change space transparency settings',
};

type ProgressAction =
  | { type: 'START_TASK'; taskName: TaskName; message?: string }
  | { type: 'COMPLETE_TASK'; taskName: TaskName; message?: string }
  | { type: 'SET_ERROR'; taskName: TaskName; message: string }
  | { type: 'RESET' };

const initialTaskState: TaskState = {
  CREATE_WEB2_CHANGE_SPACE_TRANSPARENCY_SETTINGS: { status: TaskStatus.IDLE },
  CREATE_WEB3_CHANGE_SPACE_TRANSPARENCY_SETTINGS: { status: TaskStatus.IDLE },
  UPLOAD_FILES: { status: TaskStatus.IDLE },
  LINK_WEB2_AND_WEB3_CHANGE_SPACE_TRANSPARENCY_SETTINGS: {
    status: TaskStatus.IDLE,
  },
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

type CreateChangeSpaceTransparencySettingsArg = z.infer<
  typeof schemaChangeSpaceTransparencySettings
> & {
  web3SpaceId?: number;
};

export const useChangeSpaceTransparencySettingsOrchestrator = ({
  authToken,
  config,
}: UseChangeSpaceTransparencySettingsOrchestratorInput) => {
  const web2 = useAgreementMutationsWeb2Rsc(authToken);
  const web3 = useChangeSpaceTransparencySettingsMutationsWeb3Rpc({
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

  const { trigger: createChangeSpaceTransparencySettings } = useSWRMutation(
    'createChangeSpaceTransparencySettingsOrchestration',
    async (_, { arg }: { arg: CreateChangeSpaceTransparencySettingsArg }) => {
      startTask('CREATE_WEB2_CHANGE_SPACE_TRANSPARENCY_SETTINGS');
      const inputWeb2 = schemaCreateAgreementWeb2.parse({
        ...arg,
        spaceDiscoverability: undefined,
        spaceActivityAccess: undefined,
        web3SpaceId: undefined,
      });
      const createdAgreement = await web2.createAgreement(inputWeb2);
      completeTask('CREATE_WEB2_CHANGE_SPACE_TRANSPARENCY_SETTINGS');

      const web2Slug = createdAgreement?.slug;
      const web3SpaceId = arg.web3SpaceId;
      const spaceDiscoverability = arg.spaceDiscoverability;
      const spaceActivityAccess = arg.spaceActivityAccess;

      try {
        // TODO: Implement web3 mutations when contract is available
        // if (config) {
        //   if (typeof web3SpaceId !== 'number') {
        //     throw new Error(
        //       'web3SpaceId is required for web3 proposal creation',
        //     );
        //   }
        //   if (typeof spaceDiscoverability !== 'number') {
        //     throw new Error(
        //       'spaceDiscoverability is required for web3 proposal creation',
        //     );
        //   }
        //   if (typeof spaceActivityAccess !== 'number') {
        //     throw new Error(
        //       'spaceActivityAccess is required for web3 proposal creation',
        //     );
        //   }
        //   startTask('CREATE_WEB3_CHANGE_SPACE_TRANSPARENCY_SETTINGS');
        //   await web3.createChangeSpaceTransparencySettings({
        //     spaceId: web3SpaceId,
        //     spaceDiscoverability: spaceDiscoverability,
        //     spaceActivityAccess: spaceActivityAccess,
        //   });
        //   completeTask('CREATE_WEB3_CHANGE_SPACE_TRANSPARENCY_SETTINGS');
        // }

        startTask('UPLOAD_FILES');
        const inputFiles = schemaCreateAgreementFiles.parse(arg);
        await agreementFiles.upload(inputFiles, web2Slug);
        completeTask('UPLOAD_FILES');
      } catch (err) {
        if (err instanceof Error) {
          // TODO: Uncomment when web3 is implemented
          // errorTask('CREATE_WEB3_CHANGE_SPACE_TRANSPARENCY_SETTINGS', err.message);
        }
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
      // TODO: Uncomment when web3 is implemented
      // (!config ||
      //   taskState.CREATE_WEB3_CHANGE_SPACE_TRANSPARENCY_SETTINGS.status ===
      //     TaskStatus.IS_DONE)
      // For now, skip web3 check since web3 is not implemented
      true
      ? [
          web2.createdAgreement.slug,
          // TODO: Uncomment when web3 is implemented
          // web3.changeSpaceTransparencySettingsData?.proposalId,
          'linkingWeb2AndWeb3',
        ]
      : null,
    async ([slug]) => {
      // TODO: Uncomment when web3 is implemented
      // const web3ProposalId = args[1];
      try {
        startTask('LINK_WEB2_AND_WEB3_CHANGE_SPACE_TRANSPARENCY_SETTINGS');
        const result = await web2.updateAgreementBySlug({
          slug,
          // TODO: Uncomment when web3 is implemented
          // web3ProposalId: web3ProposalId ? Number(web3ProposalId) : undefined,
          web3ProposalId: undefined,
        });
        completeTask('LINK_WEB2_AND_WEB3_CHANGE_SPACE_TRANSPARENCY_SETTINGS');
        return result;
      } catch (error) {
        if (error instanceof Error) {
          errorTask(
            'LINK_WEB2_AND_WEB3_CHANGE_SPACE_TRANSPARENCY_SETTINGS',
            error.message,
          );
        }
        throw error;
      }
    },
    {
      revalidateOnMount: true,
      shouldRetryOnError: false,
    },
  );

  const errors = React.useMemo(() => {
    return [
      web2.errorCreateAgreementMutation,
      // TODO: Uncomment when web3 is implemented
      // web3.errorChangeSpaceTransparencySettings,
      // web3.errorWaitProposalFromTx,
    ].filter(Boolean);
  }, [web2]);

  const reset = useCallback(() => {
    resetTasks();
    web2.resetCreateAgreementMutation();
    // TODO: Uncomment when web3 is implemented
    // web3.resetChangeSpaceTransparencySettings();
  }, [resetTasks, web2]);

  return {
    reset,
    createChangeSpaceTransparencySettings,
    changeSpaceTransparencySettings: {
      ...web2.createdAgreement,
      // TODO: Uncomment when web3 is implemented
      // ...web3.changeSpaceTransparencySettingsData,
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
