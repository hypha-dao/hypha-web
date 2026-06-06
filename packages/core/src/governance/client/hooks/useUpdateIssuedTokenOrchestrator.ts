'use client';

import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
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
} from './build-update-issued-token-tx';
import { useUpdateIssuedTokenMutationsWeb3Rpc } from './useUpdateIssuedTokenMutations.web3.rpc';
import {
  diffWhitelistForBatchSet,
  normalizeWhitelistAddresses,
  splitWhitelistFormToTargets,
} from './whitelist-address-diff';
import { diffWhitelistSpaceIds } from './whitelist-space-diff';
import { TokenUpdateData } from '../../types';
import type { Space } from '../../../space/types';
import { getAddress, isAddress } from 'viem';

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
  maxSupplyType?: { label: string; value: 'immutable' | 'updatable' };
  /** On-chain snapshot when the form loaded (for batchSet removals vs adds) */
  whitelistBaselineFrom?: `0x${string}`[];
  whitelistBaselineTo?: `0x${string}`[];
  /** Member-only + space-id baselines (space whitelist uses `batchAdd/Remove*Spaces`, not `batchSet`) */
  whitelistBaselineFromMembers?: `0x${string}`[];
  whitelistBaselineToMembers?: `0x${string}`[];
  whitelistBaselineFromSpaceIds?: number[];
  whitelistBaselineToSpaceIds?: number[];
  /** Resolves form space rows → web3 space ids */
  spacesForWhitelistResolution?: Space[];
  /** Top-level react-hook-form dirty keys; drives partial on-chain updates */
  changedTopLevelKeys?: string[];
  /** Sub-field dirty flags for voice-token decay (omit setter if subfield not dirty) */
  decayIntervalDirty?: boolean;
  decayPercentageDirty?: boolean;
  /** Mutual credit (RegularSpaceToken) form state */
  enableMutualCredit?: boolean;
  defaultCreditLimit?: number;
  creditWhitelistedSpaceIds?: number[];
  /** On-chain snapshot at form load — used to compute add/remove space deltas */
  creditBaselineDefaultLimit?: number;
  creditBaselineWhitelistedSpaceIds?: number[];
  /** Wallet addresses to grant minter rights on the token (all token types). */
  authorizedMinters?: string[];
  /** Wallet addresses to revoke minter rights from the token. */
  authorizedMintersToRevoke?: string[];
};

/**
 * DecayingSpaceToken updates vs form fields:
 * — Sent on-chain when dirty: name, symbol, maxSupply (0 = unlimited; omitted when limited supply
 *   + Forever Immutable — fixed cap on-chain), transferable, autoMinting, price+feed, decay
 *   interval/%, whitelist toggles, archived.
 * — Whitelist toggles: when transferable is false, both flags are forced off (empty lists
 *   previously encoded as true and could revert on execution).
 * — Member rows: `batchSetTransferWhitelist` / `batchSetReceiveWhitelist`.
 * — Space rows: `batchAdd/RemoveTransferWhitelistSpaces` / `batchAdd/RemoveReceiveWhitelistSpaces`
 *   (space contract addresses must not be passed to `batchSet*`).
 * — Not implemented: clearing on-chain price when disabling “token price”, token type (no setter).
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
    if (arg.enableLimitedSupply !== true) {
      base.maxSupply = 0;
    } else if (arg.maxSupplyType?.value === 'immutable') {
      // Forever Immutable: cap is fixed on-chain at deploy / factory; omit setMaxSupply
      // so the proposal does not emit a redundant or reverting setMaxSupply call.
    } else {
      base.maxSupply = arg.maxSupply ?? 0;
    }
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

  if (changed.has('decaySettings') && arg.type === 'voice') {
    // Always encode both decay calls together. Sending only setDecayPercentage or only
    // setDecayInterval (when the other subfield was not marked dirty) can revert on-chain
    // depending on implementation; the form always has the full pair from hydration.
    base.decayInterval = arg.decaySettings?.decayInterval;
    base.decayPercentage = arg.decaySettings?.decayPercentage;
  }

  const whitelistTouched =
    changed.has('enableAdvancedTransferControls') ||
    changed.has('transferWhitelist');
  if (whitelistTouched) {
    const spaces = arg.spacesForWhitelistResolution ?? [];
    if (!arg.enableAdvancedTransferControls) {
      base.useTransferWhitelist = false;
      base.useReceiveWhitelist = false;
      const baselineFromMembers = normalizeWhitelistAddresses(
        arg.whitelistBaselineFromMembers ?? [],
      );
      const baselineToMembers = normalizeWhitelistAddresses(
        arg.whitelistBaselineToMembers ?? [],
      );
      const baselineFromSpaceIds = arg.whitelistBaselineFromSpaceIds ?? [];
      const baselineToSpaceIds = arg.whitelistBaselineToSpaceIds ?? [];
      const clearFromMembers = diffWhitelistForBatchSet(
        baselineFromMembers,
        [],
      );
      const clearToMembers = diffWhitelistForBatchSet(baselineToMembers, []);
      if (clearFromMembers.accounts.length > 0) {
        base.batchTransferWhitelistAccounts = clearFromMembers.accounts;
        base.batchTransferWhitelistAllowed = clearFromMembers.allowed;
      }
      if (clearToMembers.accounts.length > 0) {
        base.batchReceiveWhitelistAccounts = clearToMembers.accounts;
        base.batchReceiveWhitelistAllowed = clearToMembers.allowed;
      }
      const clearFromSpaces = diffWhitelistSpaceIds(baselineFromSpaceIds, []);
      if (clearFromSpaces.remove.length > 0) {
        base.batchRemoveTransferWhitelistSpaceIds = clearFromSpaces.remove;
      }
      const clearToSpaces = diffWhitelistSpaceIds(baselineToSpaceIds, []);
      if (clearToSpaces.remove.length > 0) {
        base.batchRemoveReceiveWhitelistSpaceIds = clearToSpaces.remove;
      }
    } else if (arg.transferable === true) {
      const targetFrom = splitWhitelistFormToTargets(
        arg.transferWhitelist?.from,
        spaces,
      );
      const targetTo = splitWhitelistFormToTargets(
        arg.transferWhitelist?.to,
        spaces,
      );
      const baselineFromMembers = normalizeWhitelistAddresses(
        arg.whitelistBaselineFromMembers ?? [],
      );
      const baselineToMembers = normalizeWhitelistAddresses(
        arg.whitelistBaselineToMembers ?? [],
      );
      const baselineFromSpaceIds = arg.whitelistBaselineFromSpaceIds ?? [];
      const baselineToSpaceIds = arg.whitelistBaselineToSpaceIds ?? [];

      const useTransferWhitelist =
        targetFrom.memberAddresses.length > 0 || targetFrom.spaceIds.length > 0;
      const useReceiveWhitelist =
        targetTo.memberAddresses.length > 0 || targetTo.spaceIds.length > 0;
      base.useTransferWhitelist = useTransferWhitelist;
      base.useReceiveWhitelist = useReceiveWhitelist;

      const transferMemberDiff = diffWhitelistForBatchSet(
        baselineFromMembers,
        targetFrom.memberAddresses,
      );
      if (transferMemberDiff.accounts.length > 0) {
        base.batchTransferWhitelistAccounts = transferMemberDiff.accounts;
        base.batchTransferWhitelistAllowed = transferMemberDiff.allowed;
      }

      const transferSpaceDiff = diffWhitelistSpaceIds(
        baselineFromSpaceIds,
        targetFrom.spaceIds,
      );
      if (transferSpaceDiff.add.length > 0) {
        base.batchAddTransferWhitelistSpaceIds = transferSpaceDiff.add;
      }
      if (transferSpaceDiff.remove.length > 0) {
        base.batchRemoveTransferWhitelistSpaceIds = transferSpaceDiff.remove;
      }

      const receiveMemberDiff = diffWhitelistForBatchSet(
        baselineToMembers,
        targetTo.memberAddresses,
      );
      if (receiveMemberDiff.accounts.length > 0) {
        base.batchReceiveWhitelistAccounts = receiveMemberDiff.accounts;
        base.batchReceiveWhitelistAllowed = receiveMemberDiff.allowed;
      }

      const receiveSpaceDiff = diffWhitelistSpaceIds(
        baselineToSpaceIds,
        targetTo.spaceIds,
      );
      if (receiveSpaceDiff.add.length > 0) {
        base.batchAddReceiveWhitelistSpaceIds = receiveSpaceDiff.add;
      }
      if (receiveSpaceDiff.remove.length > 0) {
        base.batchRemoveReceiveWhitelistSpaceIds = receiveSpaceDiff.remove;
      }
    } else {
      // Non-transferable tokens cannot use transfer/receive whitelists on-chain; enabling both
      // with empty member lists produced setUse*Whitelist(true) and reverted at execution.
      base.useTransferWhitelist = false;
      base.useReceiveWhitelist = false;
    }
  }

  if (changed.has('transferable') && arg.transferable !== true) {
    base.useTransferWhitelist = false;
    base.useReceiveWhitelist = false;
  }

  if (changed.has('archiveToken')) {
    base.archiveToken = arg.archiveToken;
  }

  /**
   * Mutual credit deltas — only emitted for RegularSpaceToken types (utility, credits,
   * impact, community_currency). Voice and ownership tokens are deployed via different
   * factories without these admin functions.
   */
  const isRegularToken = (
    ['utility', 'credits', 'impact', 'community_currency'] as const
  ).includes(arg.type as never);
  if (isRegularToken) {
    const creditTouched =
      changed.has('enableMutualCredit') ||
      changed.has('defaultCreditLimit') ||
      changed.has('creditWhitelistedSpaceIds');
    if (creditTouched) {
      const baselineLimit = arg.creditBaselineDefaultLimit ?? 0;
      const baselineSpaces = arg.creditBaselineWhitelistedSpaceIds ?? [];

      if (arg.enableMutualCredit) {
        const targetLimit = arg.defaultCreditLimit ?? 0;
        if (targetLimit !== baselineLimit) {
          base.defaultCreditLimit = targetLimit;
        }
        /** Always include the issuing space so its members are eligible immediately. */
        const targetSpacesSet = new Set<number>([
          ...(arg.creditWhitelistedSpaceIds ?? []),
          arg.web3SpaceId,
        ]);
        const baselineSet = new Set(baselineSpaces);
        const toAdd = [...targetSpacesSet].filter((id) => !baselineSet.has(id));
        const toRemove = baselineSpaces.filter(
          (id) => !targetSpacesSet.has(id),
        );
        if (toAdd.length > 0) {
          base.batchAddCreditWhitelistSpaceIds = toAdd.map((id) => BigInt(id));
        }
        if (toRemove.length > 0) {
          base.batchRemoveCreditWhitelistSpaceIds = toRemove.map((id) =>
            BigInt(id),
          );
        }
      } else {
        /** Disable: zero the limit and remove every previously whitelisted space. */
        if (baselineLimit !== 0) {
          base.defaultCreditLimit = 0;
        }
        if (baselineSpaces.length > 0) {
          base.batchRemoveCreditWhitelistSpaceIds = baselineSpaces.map((id) =>
            BigInt(id),
          );
        }
      }
    }
  }

  /**
   * Authorized minters (all token types). The on-chain set is a non-enumerable
   * mapping, so the update form is action-based: `authorizedMinters` grants and
   * `authorizedMintersToRevoke` revokes. Both are merged into a single
   * `batchSetAuthorizedMinters(accounts, allowed)` call. Grant wins on conflicts.
   */
  const mintersTouched =
    changed.has('authorizedMinters') ||
    changed.has('authorizedMintersToRevoke');
  if (mintersTouched) {
    const accounts: `0x${string}`[] = [];
    const allowed: boolean[] = [];
    const seen = new Set<string>();
    const collect = (list: string[] | undefined, flag: boolean) => {
      for (const raw of list ?? []) {
        const trimmed = raw.trim();
        if (!isAddress(trimmed)) continue;
        const checksummed = getAddress(trimmed);
        const key = checksummed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        accounts.push(checksummed);
        allowed.push(flag);
      }
    };
    collect(arg.authorizedMinters, true);
    collect(arg.authorizedMintersToRevoke, false);
    if (accounts.length > 0) {
      base.batchSetAuthorizedMintersAccounts = accounts;
      base.batchSetAuthorizedMintersAllowed = allowed;
    }
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
      let createdDocumentId: number | undefined;
      const effectiveMaxSupply =
        arg.enableLimitedSupply === true ? arg.maxSupply ?? 0 : 0;
      const tokenUpdateData: TokenUpdateData = {
        name: arg.name,
        symbol: arg.symbol,
        maxSupply: effectiveMaxSupply,
        ...(arg.maxSupplyType?.value
          ? { maxSupplyTypeValue: arg.maxSupplyType.value }
          : {}),
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
        enableProposalAutoMinting: arg.enableProposalAutoMinting,
        enableAdvancedTransferControls:
          arg.enableAdvancedTransferControls === true,
        ...(arg.transferable === true
          ? {
              useTransferWhitelist:
                arg.enableAdvancedTransferControls === true
                  ? (arg.transferWhitelist?.from?.length ?? 0) > 0
                  : false,
              useReceiveWhitelist:
                arg.enableAdvancedTransferControls === true
                  ? (arg.transferWhitelist?.to?.length ?? 0) > 0
                  : false,
            }
          : {
              useTransferWhitelist: false,
              useReceiveWhitelist: false,
            }),
        ...(arg.transferWhitelist !== undefined
          ? { transferWhitelist: arg.transferWhitelist }
          : {}),
        ...(arg.whitelistBaselineFrom !== undefined ||
        arg.whitelistBaselineTo !== undefined
          ? {
              whitelistSnapshotBeforeProposal: {
                transferAddresses: normalizeWhitelistAddresses(
                  arg.whitelistBaselineFrom ?? [],
                ),
                receiveAddresses: normalizeWhitelistAddresses(
                  arg.whitelistBaselineTo ?? [],
                ),
              },
            }
          : {}),
      };
      await web2TokenMutations.createTokenUpdate({
        documentId: createdAgreement.id,
        tokenAddress: arg.tokenAddress!,
        data: tokenUpdateData,
      });
      createdDocumentId = createdAgreement.id;
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
        if (createdDocumentId !== undefined) {
          try {
            await web2TokenMutations.deleteTokenUpdate(createdDocumentId);
          } catch {
            // best-effort cleanup
          }
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

  const { errorCreateAgreementMutation, isCreatingAgreement } = web2;
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

  const hasBlockingError = errors.length > 0;
  const anyTaskFailed = Object.values(taskState).some(
    (t) => t.status === TaskStatus.ERROR,
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
    isPending:
      (progress > 0 && progress < 100 && !hasBlockingError && !anyTaskFailed) ||
      (isCreatingAgreement && !hasBlockingError && !anyTaskFailed),
    isError: hasBlockingError || anyTaskFailed,
    errors,
  };
};
