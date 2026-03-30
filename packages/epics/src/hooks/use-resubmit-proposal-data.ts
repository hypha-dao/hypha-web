'use client';

import React from 'react';
import { UseFormReturn } from 'react-hook-form';

export const useResubmitProposalData = <
  T extends {
    title?: string;
    description?: string;
    leadImage?: any;
    attachments?: any;
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
          applied?: boolean;
          redeemResubmit?: {
            token: string;
            amount: string;
            conversions: { asset: string; percentage: string }[];
          };
          [key: string]: any;
        };

        if (parsed.applied) {
          sessionStorage.removeItem('resubmitProposalData');
          return;
        }

        console.log('Resubmit data found:', parsed);

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

        form.reset(
          {
            ...form.getValues(),
            title: parsed.title || '',
            description: parsed.description || '',
            leadImage: undefined,
            attachments: undefined,
            spaceId: spaceId ?? undefined,
            creatorId: creatorId ?? undefined,
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

        form.trigger(['title', 'description'] as any[]);
        if (redeem?.conversions?.length) {
          form.trigger(['redemptions', 'conversions'] as any[]);
        }

        sessionStorage.setItem(
          'resubmitProposalData',
          JSON.stringify({
            ...parsed,
            applied: true,
          }),
        );

        setResubmitKey((prev) => prev + 1);

        console.log('Form reset with resubmit data. Current values:', {
          title: form.getValues('title' as any),
          description: form.getValues('description' as any),
        });
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
