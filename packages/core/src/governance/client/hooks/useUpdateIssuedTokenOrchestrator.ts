'use client';

import useSWRMutation from 'swr/mutation';
import { useCallback, useMemo, useReducer, useState } from 'react';
import { z } from 'zod';
import { produce } from 'immer';

import { useAgreementFileUploads } from './useAgreementFileUploads';
import { useTokenFileUploads } from './useTokenFileUploads';
import { useAgreementMutationsWeb2Rsc } from './useAgreementMutations.web2.rsc';
import {
  schemaCreateAgreementWeb2,
  schemaCreateAgreementFiles,
} from '../../validation';
import { useTokenMutationsWeb2Rsc } from './useTokenMutationWeb2.rsc';
import { Config } from '@wagmi/core';
import { ReferenceCurrency } from '../../types';
import { getPriceCurrencyFeed, type TokenType } from '../../../common';
import {
  type UpdateIssuedTokenInput,
  padUpdateIssuedTokenInputIfNoTxs,
  useUpdateIssuedTokenMutationsWeb3Rpc,
} from './useUpdateIssuedTokenMutations.web3.rpc';
import useSWR from 'swr';
import { TokenUpdateData } from '../../types';

type TaskName =
  | 'CREATE_WEB2_AGREEMENT'
  | 'CREATE_WEB3_AGREEMENT'
  | 'UPLOAD_FILES'
  | 'UPLOAD_TOKEN_ICON'
  | 'UPDATE_TOKEN'
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
  CREATE_WEB2_AGREEMENT: 'Creating Web2 Agreement...',
  CREATE_WEB3_AGREEMENT: 'Creating Web3 Agreement...',
  UPLOAD_FILES: 'Uploading files...',
  UPLOAD_TOKEN_ICON: 'Uploading token icon...',
  UPDATE_TOKEN: 'Updating token...',
  LINK_WEB2_AND_WEB3_AGREEMENT: 'Linking Web2 and Web3 agreements...',
};

const initialTaskState: TaskState = {
  CREATE_WEB2_AGREEMENT: { status: TaskStatus.IDLE },
  CREATE_WEB3_AGREEMENT: { status: TaskStatus.IDLE },
  UPLOAD_FILES: { status: TaskStatus.IDLE },
  UPLOAD_TOKEN_ICON: { status: TaskStatus.IDLE },
  UPDATE_TOKEN: { status: TaskStatus.IDLE },
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

type UpdateIssuedTokenArg = z.infer<typeof schemaCreateAgreementWeb2> & {
  tokenAddress?: string;
  agreementId?: number;
  name: string;
  symbol: string;
  maxSupply?: number;
  type: TokenType;
  iconUrl?: string | File;
  transferable?: boolean;
  isVotingToken: boolean;
  decaySettings: {
    decayInterval: number;
    decayPercentage: number;
  };
  web3SpaceId: number;
  /** Form stores amount as tokenPrice; referencePrice is kept for orchestrator compatibility */
  tokenPrice?: number;
  referencePrice?: number;
  referenceCurrency?: ReferenceCurrency;
  enableProposalAutoMinting?: boolean;
  enableLimitedSupply?: boolean;
  /** UI toggle for token price; not in schemaCreateAgreementWeb2 but always on form payload */
  enableTokenPrice?: boolean;
  enableAdvancedTransferControls?: boolean;
  transferWhitelist?: {
    to?: Array<{
      type: 'member' | 'space';
      address: string;
      includeSpaceMembers?: boolean;
    }>;
    from?: Array<{
      type: 'member' | 'space';
      address: string;
      includeSpaceMembers?: boolean;
    }>;
  };
  archiveToken?: boolean;
  /** Top-level react-hook-form dirty keys; drives partial on-chain updates */
  changedTopLevelKeys?: string[];
};

/**
 * DecayingSpaceToken updates vs form fields:
 * — Sent on-chain when dirty: name, symbol, maxSupply (0 = unlimited), transferable, autoMinting,
 *   price+feed, decay interval/%, whitelist toggles, archived.
 * — Not implemented here: whitelist address membership (e.g. batchSetTransferWhitelist),
 *   clearing on-chain price when disabling “token price”, token type (no setter on contract).
 * — DB / Web2 only: icon URL, token type label stored off-chain.
 * — If no calldata would be produced, the proposal still includes setTokenName(arg.name)
 *   so createProposal is never called with an empty transaction list (reverts).
 */
function buildPartialUpdateIssuedTokenWeb3Input(
  arg: UpdateIssuedTokenArg,
  changed: Set<string>,
): UpdateIssuedTokenInput {
  const base: UpdateIssuedTokenInput = {
    address: arg.tokenAddress as `0x${string}`,
    spaceId: arg.web3SpaceId,
  };

  if (changed.has('name')) {
    base.name = arg.name;
  }
  if (changed.has('symbol')) {
    base.symbol = arg.symbol;
  }

  if (
    changed.has('maxSupply') ||
    changed.has('enableLimitedSupply') ||
    changed.has('maxSupplyType')
  ) {
    base.maxSupply = arg.enableLimitedSupply === true ? arg.maxSupply ?? 0 : 0;
  }

  if (changed.has('transferable')) {
    base.transferable = arg.transferable;
  }

  if (changed.has('enableProposalAutoMinting')) {
    base.autoMinting = arg.enableProposalAutoMinting;
  }

  const priceTouched =
    changed.has('enableTokenPrice') ||
    changed.has('tokenPrice') ||
    changed.has('referenceCurrency');
  if (priceTouched) {
    if (arg.enableTokenPrice) {
      const refPrice = arg.referencePrice ?? arg.tokenPrice;
      const tokenPriceMicro =
        refPrice !== undefined ? Math.round(refPrice * 1_000_000) : undefined;
      const priceCurrencyFeed =
        refPrice !== undefined && arg.referenceCurrency !== undefined
          ? getPriceCurrencyFeed(arg.referenceCurrency)
          : undefined;
      if (tokenPriceMicro !== undefined && priceCurrencyFeed !== undefined) {
        base.tokenPrice = tokenPriceMicro;
        base.priceCurrencyFeed = priceCurrencyFeed;
      }
    } else {
      // Clear on-chain price when the user turns pricing off (micro-units + zero feed)
      base.tokenPrice = 0;
      base.priceCurrencyFeed =
        '0x0000000000000000000000000000000000000000' as `0x${string}`;
    }
  }

  if (changed.has('decaySettings')) {
    base.decayInterval = arg.decaySettings?.decayInterval;
    base.decayPercentage = arg.decaySettings?.decayPercentage;
  }

  const whitelistTouched =
    changed.has('enableAdvancedTransferControls') ||
    changed.has('transferWhitelist');
  if (whitelistTouched) {
    if (!arg.enableAdvancedTransferControls) {
      base.useTransferWhitelist = false;
      base.useReceiveWhitelist = false;
    } else {
      base.useTransferWhitelist = !!(
        arg.transferWhitelist?.from && arg.transferWhitelist.from.length > 0
      );
      base.useReceiveWhitelist = !!(
        arg.transferWhitelist?.to && arg.transferWhitelist.to.length > 0
      );
    }
  }

  if (changed.has('archiveToken')) {
    base.archiveToken = arg.archiveToken;
  }

  return base;
}

export const useUpdateIssuedTokenOrchestrator = ({
  authToken,
  config,
}: {
  authToken?: string | null;
  config?: Config;
}) => {
  const web2 = useAgreementMutationsWeb2Rsc(authToken);
  const web2TokenMutations = useTokenMutationsWeb2Rsc(authToken);
  const web3 = useUpdateIssuedTokenMutationsWeb3Rpc({
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
  const tokenFiles = useTokenFileUploads(authToken);

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

  const { trigger: updateIssuedToken } = useSWRMutation(
    'updateIssuedTokenOrchestration',
    async (_: string, { arg }: { arg: UpdateIssuedTokenArg }) => {
      if (!arg.tokenAddress || !arg.web3SpaceId) {
        throw new Error('Either tokenAddress and web3SpaceId must be provided');
      }
      startTask('CREATE_WEB2_AGREEMENT');
      const inputWeb2 = schemaCreateAgreementWeb2.parse(arg);
      const createdAgreement = await web2.createAgreement(inputWeb2);
      completeTask('CREATE_WEB2_AGREEMENT');

      const web2Slug = createdAgreement?.slug;

      const changedTopLevel = new Set(arg.changedTopLevelKeys ?? []);
      const iconTouched =
        arg.iconUrl instanceof File || changedTopLevel.has('iconUrl');

      let iconUrlForUpdate: string | undefined;
      if (arg.iconUrl instanceof File) {
        startTask('UPLOAD_TOKEN_ICON');
        const result = await tokenFiles.upload({ iconUrl: arg.iconUrl });
        iconUrlForUpdate = result.iconUrl;
        completeTask('UPLOAD_TOKEN_ICON');
      } else {
        startTask('UPLOAD_TOKEN_ICON');
        completeTask('UPLOAD_TOKEN_ICON');
        if (iconTouched && typeof arg.iconUrl === 'string') {
          iconUrlForUpdate = arg.iconUrl;
        }
      }

      startTask('UPDATE_TOKEN');
      // Save token update data to DB for deferred update after proposal execution
      if (!createdAgreement?.id) {
        throw new Error('Created agreement missing ID');
      }
      const effectiveMaxSupply =
        arg.enableLimitedSupply === true ? arg.maxSupply ?? 0 : 0;
      const tokenUpdateData: TokenUpdateData = {
        name: arg.name,
        symbol: arg.symbol,
        maxSupply: effectiveMaxSupply,
        type: arg.type,
        ...(iconTouched && iconUrlForUpdate !== undefined
          ? { iconUrl: iconUrlForUpdate }
          : {}),
        transferable: arg.transferable,
        isVotingToken: arg.isVotingToken,
        decayInterval: arg.decaySettings?.decayInterval,
        decayPercentage: arg.decaySettings?.decayPercentage,
        referencePrice: arg.referencePrice ?? arg.tokenPrice,
        referenceCurrency: arg.referenceCurrency,
        archiveToken: arg.archiveToken,
      };
      await web2TokenMutations.createTokenUpdate({
        documentId: createdAgreement.id,
        tokenAddress: arg.tokenAddress!,
        data: tokenUpdateData,
      });
      completeTask('UPDATE_TOKEN');

      try {
        if (config) {
          const partialWeb3 = buildPartialUpdateIssuedTokenWeb3Input(
            arg,
            changedTopLevel,
          );
          const web3ProposalArg = padUpdateIssuedTokenInputIfNoTxs(
            partialWeb3,
            arg.name,
          );

          startTask('CREATE_WEB3_AGREEMENT');
          await web3.updateIssuedToken(web3ProposalArg);
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
      taskState.CREATE_WEB3_AGREEMENT.status === TaskStatus.IS_DONE &&
      web3.updatedIssuedToken?.proposalId
      ? [
          web2.createdAgreement.slug,
          web3.updatedIssuedToken.proposalId,
          'linkingWeb2AndWeb3',
        ]
      : null,
    async ([slug, web3ProposalId]) => {
      try {
        startTask('LINK_WEB2_AND_WEB3_AGREEMENT');
        const result = await web2.updateAgreementBySlug({
          slug,
          web3ProposalId: Number(web3ProposalId),
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

  const { errorCreateAgreementMutation } = web2;
  const { errorUpdateIssuedToken, errorWaitTokenFromTx } = web3;
  const {
    errorUpdateTokenMutation,
    errorCreateTokenUpdateMutation,
    errorApplyTokenUpdateMutation,
    errorDeleteTokenUpdateMutation,
  } = web2TokenMutations;

  const errors = useMemo(
    () =>
      [
        errorCreateAgreementMutation,
        errorUpdateIssuedToken,
        errorWaitTokenFromTx,
        errorUpdateTokenMutation,
        errorCreateTokenUpdateMutation,
        errorApplyTokenUpdateMutation,
        errorDeleteTokenUpdateMutation,
      ].filter(Boolean),
    [
      errorCreateAgreementMutation,
      errorUpdateIssuedToken,
      errorWaitTokenFromTx,
      errorUpdateTokenMutation,
      errorCreateTokenUpdateMutation,
      errorApplyTokenUpdateMutation,
      errorDeleteTokenUpdateMutation,
    ],
  );

  const reset = useCallback(() => {
    resetTasks();
    web2.resetCreateAgreementMutation();
    web3.resetUpdateIssuedToken();
    web2TokenMutations.resetUpdateTokenMutation();
    web2TokenMutations.resetCreateTokenUpdateMutation();
    web2TokenMutations.resetApplyTokenUpdateMutation();
    web2TokenMutations.resetDeleteTokenUpdateMutation();
  }, [resetTasks, web2, web3, web2TokenMutations]);

  return {
    reset,
    updateIssuedToken,
    agreement: {
      ...web2.createdAgreement,
      ...web3.updatedIssuedToken,
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
