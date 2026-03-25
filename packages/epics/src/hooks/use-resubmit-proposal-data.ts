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

        let resubmitTokenAddress: string | undefined;
        try {
          const tokenFormRaw = sessionStorage.getItem(
            'resubmitUpdateIssuedTokenForm',
          );
          if (tokenFormRaw) {
            const tf = JSON.parse(tokenFormRaw) as { tokenAddress?: string };
            if (tf?.tokenAddress) {
              resubmitTokenAddress = tf.tokenAddress;
            }
          }
        } catch {
          // ignore invalid token resubmit payload
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
            ...(resubmitTokenAddress
              ? { tokenAddress: resubmitTokenAddress }
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

        if (resubmitTokenAddress) {
          form.setValue('tokenAddress' as any, resubmitTokenAddress as any, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }

        form.trigger(['title', 'description'] as any[]);

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
