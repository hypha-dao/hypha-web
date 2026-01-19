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
  const hasAppliedResubmitData = React.useRef(false);
  const [resubmitKey, setResubmitKey] = React.useState(0);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasAppliedResubmitData.current) return;

    const applyResubmitData = () => {
      try {
        const data = sessionStorage.getItem('resubmitProposalData');
        if (data) {
          const parsed = JSON.parse(data);
          console.log('Resubmit data found:', parsed);

          if (parsed.leadImage || parsed.attachments) {
            sessionStorage.setItem(
              'resubmitFormData',
              JSON.stringify({
                leadImage: parsed.leadImage,
                attachments: parsed.attachments,
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

          form.setValue('title' as any, parsed.title || '', {
            shouldDirty: true,
            shouldValidate: true,
          });
          form.setValue('description' as any, parsed.description || '', {
            shouldDirty: true,
            shouldValidate: true,
          });

          if (parsed.attachments && parsed.attachments.length > 0) {
            form.setValue('attachments' as any, parsed.attachments, {
              shouldDirty: true,
              shouldValidate: false,
            });
          }

          if (parsed.leadImage && typeof parsed.leadImage === 'string') {
            form.setValue('leadImage' as any, parsed.leadImage, {
              shouldDirty: true,
              shouldValidate: false,
            });
          }

          form.trigger(['title', 'description'] as any[]);

          setResubmitKey((prev) => prev + 1);
          hasAppliedResubmitData.current = true;

          sessionStorage.removeItem('resubmitProposalData');

          console.log('Form reset with resubmit data. Current values:', {
            title: form.getValues('title' as any),
            description: form.getValues('description' as any),
          });
        }
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
