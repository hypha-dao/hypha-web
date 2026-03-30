'use client';

import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  RESUBMIT_UPDATE_ISSUED_TOKEN_EMBEDDED_FIELD,
  UPDATE_ISSUED_TOKEN_RESUBMIT_EVENT,
  type UpdateIssuedTokenResubmitPayload,
} from '../proposals/update-issued-token-resubmit';

/** Clears resubmit hydration keys after a successful publish so the next visit shows an empty form. */
export function clearResubmitProposalSessionStorage(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('resubmitProposalData');
  sessionStorage.removeItem('resubmitFormData');
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
) => {
  const [resubmitKey, setResubmitKey] = React.useState(0);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyResubmitData = () => {
      try {
        const stored = sessionStorage.getItem('resubmitProposalData');
        if (!stored) {
          return;
        }

        const parsed = JSON.parse(stored) as {
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
          applied?: boolean;
          redeemResubmit?: {
            token: string;
            amount: string;
            conversions: { asset: string; percentage: string }[];
          };
          [key: string]: any;
          [RESUBMIT_UPDATE_ISSUED_TOKEN_EMBEDDED_FIELD]?: UpdateIssuedTokenResubmitPayload;
        };

        // Re-apply whenever this data is present (including `applied: true`), so
        // navigating back to the create form after a resubmit still hydrates the form.

        if (parsed.leadImage || parsed.attachments) {
          sessionStorage.setItem(
            'resubmitFormData',
            JSON.stringify({
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

        const fieldsToTrigger: string[] = ['title', 'description'];
        if (parsed.spaceDiscoverability !== undefined) {
          fieldsToTrigger.push('spaceDiscoverability');
        }
        if (parsed.spaceActivityAccess !== undefined) {
          fieldsToTrigger.push('spaceActivityAccess');
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
        form.trigger(fieldsToTrigger as any[]);

        sessionStorage.setItem(
          'resubmitProposalData',
          JSON.stringify({
            ...parsed,
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
        sessionStorage.removeItem('resubmitProposalData');
        sessionStorage.removeItem('resubmitFormData');
      }
    };

    const timeoutId = setTimeout(applyResubmitData, 300);

    return () => clearTimeout(timeoutId);
  }, [form, spaceId, creatorId]);

  return { resubmitKey };
};
