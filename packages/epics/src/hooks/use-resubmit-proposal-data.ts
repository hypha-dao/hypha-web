'use client';

import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { usePathname } from 'next/navigation';
import {
  RESUBMIT_UPDATE_ISSUED_TOKEN_EMBEDDED_FIELD,
  UPDATE_ISSUED_TOKEN_RESUBMIT_EVENT,
  type UpdateIssuedTokenResubmitPayload,
} from '../proposals/update-issued-token-resubmit';
import {
  RESUBMIT_FORM_DATA_KEY,
  RESUBMIT_PROPOSAL_DATA_KEY,
  type ResubmitProposalTemplateSegment,
  getProposalTemplateSegmentFromPathname,
  inferResubmitTemplateSegmentFromPayload,
  isLegacyGenericResubmitSegment,
} from '../utils/resubmit-proposal-template';

/** Clears resubmit hydration keys after a successful publish so the next visit shows an empty form. */
export function clearResubmitProposalSessionStorage(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(RESUBMIT_PROPOSAL_DATA_KEY);
  sessionStorage.removeItem(RESUBMIT_FORM_DATA_KEY);
}

export const useResubmitProposalData = <
  T extends {
    title?: string;
    description?: string;
    leadImage?: string | File;
    attachments?: Array<
      | {
          url?: string;
          name?: string;
        }
      | File
      | string
    >;
    tokenAddress?: string;
  },
>(
  form: UseFormReturn<T>,
  spaceId?: number | null,
  creatorId?: number | null,
  /** URL segment after `agreements/create/`; when omitted, derived from the current pathname. */
  resubmitTemplateSegment?: ResubmitProposalTemplateSegment,
) => {
  const [resubmitKey, setResubmitKey] = React.useState(0);
  const pathname = usePathname();

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyResubmitData = () => {
      try {
        const stored = sessionStorage.getItem(RESUBMIT_PROPOSAL_DATA_KEY);
        if (!stored) {
          return;
        }

        const parsed = JSON.parse(stored) as {
          resubmitTemplateSegment?: string;
          title?: string;
          description?: string;
          leadImage?: any;
          attachments?: any;
          mint?: {
            amount?: string;
            token?: string;
          };
          tokenBurning?: {
            token?: string;
            burns?: Array<{
              type?: 'member' | 'space';
              address?: string;
              amount?: string;
              allBalance?: boolean;
            }>;
          };
          spaceDiscoverability?: number;
          spaceActivityAccess?: number;
          votingMethod?: '1m1v' | '1v1v' | '1t1v';
          quorumAndUnity?: { quorum?: number; unity?: number };
          token?: string;
          members?: Array<{ member?: string; number?: number }>;
          votingDuration?: number;
          autoExecution?: boolean;
          entryMethod?: number;
          tokenBase?: { amount?: number; token?: string };
          space?: number;
          member?: string;
          spaceToSpaceTargetAddress?: string;
          spaceToSpaceMemberAddress?: string;
          issueNewTokenForm?: Record<string, unknown>;
          tokenBackingVault?: Record<string, unknown>;
          spaceTokenPurchaseForm?: Record<string, unknown>;
          buyHyphaTokensForm?: Record<string, unknown>;
          applied?: boolean;
          redeemResubmit?: {
            token: string;
            amount: string;
            conversions: { asset: string; percentage: string }[];
          };
          [key: string]: any;
          [RESUBMIT_UPDATE_ISSUED_TOKEN_EMBEDDED_FIELD]?: UpdateIssuedTokenResubmitPayload;
        };

        const currentSegment: ResubmitProposalTemplateSegment =
          resubmitTemplateSegment ??
          getProposalTemplateSegmentFromPathname(pathname) ??
          '';

        const storedSegment =
          typeof parsed.resubmitTemplateSegment === 'string'
            ? parsed.resubmitTemplateSegment
            : inferResubmitTemplateSegmentFromPayload(parsed);

        const templateMatches =
          storedSegment === currentSegment ||
          (storedSegment === undefined &&
            isLegacyGenericResubmitSegment(currentSegment));

        if (!templateMatches) {
          return;
        }

        // Re-apply whenever this data is present (including `applied: true`), so
        // navigating back to the create form after a resubmit still hydrates the form.

        if (parsed.leadImage || parsed.attachments) {
          sessionStorage.setItem(
            RESUBMIT_FORM_DATA_KEY,
            JSON.stringify({
              resubmitTemplateSegment: currentSegment,
              leadImage: parsed.leadImage,
              attachments: parsed.attachments,
              applied: false,
            }),
          );
        }

        const embeddedUpdateToken =
          parsed[RESUBMIT_UPDATE_ISSUED_TOKEN_EMBEDDED_FIELD];
        const resubmitTokenAddress =
          embeddedUpdateToken?.tokenAddress !== undefined
            ? embeddedUpdateToken.tokenAddress
            : undefined;

        const currentTokenRaw = form.getValues('tokenAddress' as never) as
          | string
          | undefined;
        const hasChosenToken =
          typeof currentTokenRaw === 'string' && currentTokenRaw.trim() !== '';

        form.reset(
          {
            ...form.getValues(),
            title: parsed.title || '',
            description: parsed.description || '',
            ...(parsed.mint ? { mint: parsed.mint } : {}),
            ...(parsed.tokenBurning
              ? { tokenBurning: parsed.tokenBurning }
              : {}),
            ...(parsed.spaceDiscoverability !== undefined
              ? { spaceDiscoverability: parsed.spaceDiscoverability }
              : {}),
            ...(parsed.spaceActivityAccess !== undefined
              ? { spaceActivityAccess: parsed.spaceActivityAccess }
              : {}),
            ...(parsed.votingMethod !== undefined
              ? { votingMethod: parsed.votingMethod }
              : {}),
            ...(parsed.quorumAndUnity
              ? { quorumAndUnity: parsed.quorumAndUnity }
              : {}),
            ...(parsed.token !== undefined ? { token: parsed.token } : {}),
            ...(parsed.members !== undefined
              ? { members: parsed.members }
              : {}),
            ...(parsed.votingDuration !== undefined
              ? { votingDuration: parsed.votingDuration }
              : {}),
            ...(typeof parsed.autoExecution === 'boolean'
              ? { autoExecution: parsed.autoExecution }
              : {}),
            ...(typeof parsed.entryMethod === 'number'
              ? { entryMethod: parsed.entryMethod }
              : {}),
            ...(parsed.tokenBase !== undefined && parsed.tokenBase !== null
              ? { tokenBase: parsed.tokenBase }
              : {}),
            ...(parsed.spaceToSpaceTargetAddress !== undefined
              ? { space: parsed.spaceToSpaceTargetAddress }
              : typeof parsed.space === 'number'
              ? { space: parsed.space }
              : {}),
            ...(parsed.spaceToSpaceMemberAddress !== undefined
              ? { member: parsed.spaceToSpaceMemberAddress }
              : parsed.member !== undefined
              ? { member: parsed.member }
              : {}),
            leadImage: undefined,
            attachments: undefined,
            spaceId: spaceId ?? undefined,
            creatorId: creatorId ?? undefined,
            ...(hasChosenToken
              ? {}
              : resubmitTokenAddress
              ? { tokenAddress: resubmitTokenAddress }
              : parsed.tokenAddress !== undefined
              ? { tokenAddress: parsed.tokenAddress }
              : {}),
            ...(typeof parsed.activatePurchase === 'boolean'
              ? { activatePurchase: parsed.activatePurchase }
              : {}),
            ...(parsed.purchasePrice !== undefined
              ? { purchasePrice: parsed.purchasePrice }
              : {}),
            ...(parsed.purchaseCurrency !== undefined
              ? { purchaseCurrency: parsed.purchaseCurrency }
              : {}),
            ...(parsed.tokensAvailableForPurchase !== undefined
              ? {
                  tokensAvailableForPurchase: parsed.tokensAvailableForPurchase,
                }
              : {}),
            ...(parsed.issueNewTokenForm &&
            typeof parsed.issueNewTokenForm === 'object'
              ? (parsed.issueNewTokenForm as object)
              : {}),
            ...(parsed.tokenBackingVault &&
            typeof parsed.tokenBackingVault === 'object'
              ? { tokenBackingVault: parsed.tokenBackingVault }
              : {}),
            ...(parsed.spaceTokenPurchaseForm &&
            typeof parsed.spaceTokenPurchaseForm === 'object'
              ? (parsed.spaceTokenPurchaseForm as Record<string, unknown>)
              : {}),
            ...(parsed.buyHyphaTokensForm &&
            typeof parsed.buyHyphaTokensForm === 'object'
              ? (parsed.buyHyphaTokensForm as Record<string, unknown>)
              : {}),
          } as T,
          {
            keepDefaultValues: false,
          },
        );

        form.setValue('title' as any, (parsed.title || '') as any, {
          shouldDirty: true,
          shouldValidate: true,
        });
        form.setValue('description' as any, (parsed.description || '') as any, {
          shouldDirty: true,
          shouldValidate: true,
        });

        if (parsed.attachments && parsed.attachments.length > 0) {
          form.setValue('attachments' as any, parsed.attachments as any, {
            shouldDirty: true,
            shouldValidate: false,
          });
        }

        if (parsed.leadImage && typeof parsed.leadImage === 'string') {
          form.setValue('leadImage' as any, parsed.leadImage as any, {
            shouldDirty: true,
            shouldValidate: false,
          });
        }

        if (parsed.spaceDiscoverability !== undefined) {
          form.setValue(
            'spaceDiscoverability' as any,
            parsed.spaceDiscoverability as any,
            {
              shouldDirty: true,
              shouldValidate: true,
            },
          );
        }

        if (parsed.spaceActivityAccess !== undefined) {
          form.setValue(
            'spaceActivityAccess' as any,
            parsed.spaceActivityAccess as any,
            {
              shouldDirty: true,
              shouldValidate: true,
            },
          );
        }

        const redeem = parsed.redeemResubmit;
        if (
          redeem?.token &&
          redeem.amount !== undefined &&
          redeem.amount !== '' &&
          redeem.conversions?.length
        ) {
          form.setValue(
            'redemptions' as any,
            [{ token: redeem.token, amount: redeem.amount }] as any,
            {
              shouldDirty: true,
              shouldValidate: true,
            },
          );
          form.setValue('conversions' as any, redeem.conversions as any, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }

        if (parsed.votingMethod !== undefined) {
          form.setValue('votingMethod' as any, parsed.votingMethod as any, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }

        if (parsed.quorumAndUnity !== undefined) {
          if (parsed.quorumAndUnity.quorum !== undefined) {
            form.setValue(
              'quorumAndUnity.quorum' as any,
              parsed.quorumAndUnity.quorum as any,
              { shouldDirty: true, shouldValidate: true },
            );
          }
          if (parsed.quorumAndUnity.unity !== undefined) {
            form.setValue(
              'quorumAndUnity.unity' as any,
              parsed.quorumAndUnity.unity as any,
              { shouldDirty: true, shouldValidate: true },
            );
          }
        }

        if (parsed.token !== undefined) {
          form.setValue('token' as any, parsed.token as any, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }

        if (parsed.members !== undefined) {
          form.setValue('members' as any, parsed.members as any, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }

        if (parsed.votingDuration !== undefined) {
          form.setValue('votingDuration' as any, parsed.votingDuration as any, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }

        if (typeof parsed.autoExecution === 'boolean') {
          form.setValue('autoExecution' as any, parsed.autoExecution as any, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }

        if (typeof parsed.entryMethod === 'number') {
          form.setValue('entryMethod' as any, parsed.entryMethod as any, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }

        if (parsed.tokenBase !== undefined && parsed.tokenBase !== null) {
          form.setValue('tokenBase' as any, parsed.tokenBase as any, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }

        if (parsed.spaceToSpaceTargetAddress !== undefined) {
          form.setValue(
            'space' as any,
            parsed.spaceToSpaceTargetAddress as any,
            {
              shouldDirty: true,
              shouldValidate: true,
            },
          );
        } else if (typeof parsed.space === 'number') {
          form.setValue('space' as any, parsed.space as any, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }

        if (parsed.spaceToSpaceMemberAddress !== undefined) {
          form.setValue(
            'member' as any,
            parsed.spaceToSpaceMemberAddress as any,
            {
              shouldDirty: true,
              shouldValidate: true,
            },
          );
        } else if (parsed.member !== undefined) {
          form.setValue('member' as any, parsed.member as any, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }

        if (!hasChosenToken) {
          if (resubmitTokenAddress) {
            form.setValue('tokenAddress' as any, resubmitTokenAddress as any, {
              shouldDirty: true,
              shouldValidate: true,
            });
          } else if (parsed.tokenAddress !== undefined) {
            form.setValue('tokenAddress' as any, parsed.tokenAddress as any, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }
        }

        if (typeof parsed.activatePurchase === 'boolean') {
          form.setValue(
            'activatePurchase' as any,
            parsed.activatePurchase as any,
            {
              shouldDirty: true,
              shouldValidate: true,
            },
          );
        }

        if (parsed.purchasePrice !== undefined) {
          form.setValue('purchasePrice' as any, parsed.purchasePrice as any, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }

        if (parsed.purchaseCurrency !== undefined) {
          form.setValue(
            'purchaseCurrency' as any,
            parsed.purchaseCurrency as any,
            {
              shouldDirty: true,
              shouldValidate: true,
            },
          );
        }

        if (parsed.tokensAvailableForPurchase !== undefined) {
          form.setValue(
            'tokensAvailableForPurchase' as any,
            parsed.tokensAvailableForPurchase as any,
            {
              shouldDirty: true,
              shouldValidate: true,
            },
          );
        }

        const issueInj = parsed.issueNewTokenForm;
        const vaultInj = parsed.tokenBackingVault;
        if (vaultInj && typeof vaultInj === 'object') {
          form.setValue('tokenBackingVault' as any, vaultInj as any, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }

        const stpInj = parsed.spaceTokenPurchaseForm;
        if (stpInj && typeof stpInj === 'object') {
          const stp = stpInj as Record<string, unknown>;
          const setStp = (key: string, val: unknown) => {
            if (val === undefined) return;
            form.setValue(key as any, val as any, {
              shouldDirty: true,
              shouldValidate: true,
            });
          };
          setStp('tokenAddress', stp.tokenAddress);
          setStp('activatePurchase', stp.activatePurchase);
          setStp('purchaseCurrency', stp.purchaseCurrency);
          setStp('purchasePrice', stp.purchasePrice);
          setStp('tokensAvailableForPurchase', stp.tokensAvailableForPurchase);
        }

        const bhtInj = parsed.buyHyphaTokensForm;
        if (bhtInj && typeof bhtInj === 'object') {
          const bht = bhtInj as Record<string, unknown>;
          const payout = bht.payout as Record<string, unknown> | undefined;
          if (payout?.amount !== undefined) {
            form.setValue('payout.amount' as any, payout.amount as any, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }
          if (payout?.token !== undefined) {
            form.setValue('payout.token' as any, payout.token as any, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }
          if (bht.recipient !== undefined) {
            form.setValue('recipient' as any, bht.recipient as any, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }
        }

        if (issueInj && typeof issueInj === 'object') {
          const ink = issueInj as Record<string, unknown>;
          const setIssue = (key: string, val: unknown) => {
            if (val === undefined) return;
            form.setValue(key as any, val as any, {
              shouldDirty: true,
              shouldValidate: true,
            });
          };
          setIssue('name', ink.name);
          setIssue('symbol', ink.symbol);
          setIssue('iconUrl', ink.iconUrl);
          setIssue('type', ink.type);
          setIssue('maxSupply', ink.maxSupply);
          setIssue('maxSupplyType', ink.maxSupplyType);
          setIssue('decaySettings', ink.decaySettings);
          setIssue('isVotingToken', ink.isVotingToken);
          setIssue('transferable', ink.transferable);
          setIssue(
            'enableAdvancedTransferControls',
            ink.enableAdvancedTransferControls,
          );
          setIssue('transferWhitelist', ink.transferWhitelist);
          setIssue('enableProposalAutoMinting', ink.enableProposalAutoMinting);
          setIssue('enableLimitedSupply', ink.enableLimitedSupply);
          setIssue('enableTokenPrice', ink.enableTokenPrice);
          setIssue('referenceCurrency', ink.referenceCurrency);
          setIssue('tokenPrice', ink.tokenPrice);
        }

        const fieldsToTrigger: string[] = ['title', 'description'];
        if (parsed.spaceDiscoverability !== undefined) {
          fieldsToTrigger.push('spaceDiscoverability');
        }
        if (parsed.spaceActivityAccess !== undefined) {
          fieldsToTrigger.push('spaceActivityAccess');
        }
        if (parsed.votingMethod !== undefined) {
          fieldsToTrigger.push(
            'votingMethod',
            'quorumAndUnity',
            'votingDuration',
            'autoExecution',
            'members',
            'token',
          );
        }
        if (typeof parsed.entryMethod === 'number') {
          fieldsToTrigger.push('entryMethod');
        }
        if (parsed.tokenBase !== undefined && parsed.tokenBase !== null) {
          fieldsToTrigger.push('tokenBase');
        }
        if (parsed.spaceToSpaceTargetAddress !== undefined) {
          fieldsToTrigger.push('space', 'member');
        } else {
          if (typeof parsed.space === 'number') {
            fieldsToTrigger.push('space');
          }
          if (parsed.member !== undefined) {
            fieldsToTrigger.push('member');
          }
        }
        if (
          resubmitTokenAddress !== undefined ||
          parsed.tokenAddress !== undefined
        ) {
          fieldsToTrigger.push('tokenAddress');
        }
        if (typeof parsed.activatePurchase === 'boolean') {
          fieldsToTrigger.push('activatePurchase');
        }
        if (parsed.purchasePrice !== undefined) {
          fieldsToTrigger.push('purchasePrice');
        }
        if (parsed.purchaseCurrency !== undefined) {
          fieldsToTrigger.push('purchaseCurrency');
        }
        if (parsed.tokensAvailableForPurchase !== undefined) {
          fieldsToTrigger.push('tokensAvailableForPurchase');
        }
        if (
          redeem?.token &&
          redeem.amount !== undefined &&
          redeem.amount !== '' &&
          redeem.conversions?.length
        ) {
          fieldsToTrigger.push('redemptions', 'conversions');
        }
        if (
          parsed.issueNewTokenForm &&
          typeof parsed.issueNewTokenForm === 'object'
        ) {
          fieldsToTrigger.push(
            'name',
            'symbol',
            'iconUrl',
            'type',
            'maxSupply',
            'maxSupplyType',
            'decaySettings',
            'isVotingToken',
            'transferable',
            'enableAdvancedTransferControls',
            'transferWhitelist',
            'enableProposalAutoMinting',
            'enableLimitedSupply',
            'enableTokenPrice',
            'referenceCurrency',
            'tokenPrice',
          );
        }
        if (
          parsed.tokenBackingVault &&
          typeof parsed.tokenBackingVault === 'object'
        ) {
          fieldsToTrigger.push('tokenBackingVault');
        }
        if (
          parsed.spaceTokenPurchaseForm &&
          typeof parsed.spaceTokenPurchaseForm === 'object'
        ) {
          fieldsToTrigger.push(
            'tokenAddress',
            'activatePurchase',
            'purchasePrice',
            'purchaseCurrency',
            'tokensAvailableForPurchase',
          );
        }
        if (
          parsed.buyHyphaTokensForm &&
          typeof parsed.buyHyphaTokensForm === 'object'
        ) {
          fieldsToTrigger.push('payout', 'recipient');
        }
        form.trigger(fieldsToTrigger as any[]);

        sessionStorage.setItem(
          RESUBMIT_PROPOSAL_DATA_KEY,
          JSON.stringify({
            ...parsed,
            resubmitTemplateSegment:
              typeof parsed.resubmitTemplateSegment === 'string'
                ? parsed.resubmitTemplateSegment
                : currentSegment,
            applied: true,
          }),
        );

        if (embeddedUpdateToken && typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(UPDATE_ISSUED_TOKEN_RESUBMIT_EVENT, {
              detail: embeddedUpdateToken,
            }),
          );
        }

        setResubmitKey((prev) => prev + 1);
      } catch (error) {
        console.error('Error reading resubmit data:', error);
        sessionStorage.removeItem(RESUBMIT_PROPOSAL_DATA_KEY);
        sessionStorage.removeItem(RESUBMIT_FORM_DATA_KEY);
      }
    };

    const timeoutId = setTimeout(applyResubmitData, 300);

    return () => clearTimeout(timeoutId);
  }, [form, spaceId, creatorId, resubmitTemplateSegment, pathname]);

  return { resubmitKey };
};
