'use client';

import React from 'react';
import { Path, PathValue, UseFormReturn } from 'react-hook-form';

type ResubmitFormValues = {
  title?: string;
  description?: string;
  leadImage?: unknown;
  attachments?: unknown;
  spaceId?: number;
  creatorId?: number;
};

type StoredResubmitData = {
  title?: string;
  description?: string;
  leadImage?: unknown;
  attachments?: unknown;
  applied?: boolean;
  [key: string]: unknown;
};

export const useResubmitProposalData = <T extends ResubmitFormValues>(
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

        const parsed = JSON.parse(stored) as StoredResubmitData;

        const titleField = 'title' as Path<T>;
        const descriptionField = 'description' as Path<T>;
        const attachmentsField = 'attachments' as Path<T>;
        const leadImageField = 'leadImage' as Path<T>;

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

        form.setValue(
          titleField,
          (parsed.title || '') as PathValue<T, typeof titleField>,
          {
            shouldDirty: true,
            shouldValidate: true,
          },
        );
        form.setValue(
          descriptionField,
          (parsed.description || '') as PathValue<T, typeof descriptionField>,
          {
            shouldDirty: true,
            shouldValidate: true,
          },
        );

        if (
          Array.isArray(parsed.attachments) &&
          parsed.attachments.length > 0
        ) {
          form.setValue(
            attachmentsField,
            parsed.attachments as PathValue<T, typeof attachmentsField>,
            {
              shouldDirty: true,
              shouldValidate: false,
            },
          );
        }

        if (
          typeof parsed.leadImage === 'string' &&
          parsed.leadImage.length > 0
        ) {
          form.setValue(
            leadImageField,
            parsed.leadImage as PathValue<T, typeof leadImageField>,
            {
              shouldDirty: true,
              shouldValidate: false,
            },
          );
        }

        form.trigger([titleField, descriptionField]);

        sessionStorage.setItem(
          'resubmitProposalData',
          JSON.stringify({
            ...parsed,
            applied: true,
          }),
        );

        setResubmitKey((prev) => prev + 1);

        console.log('Form reset with resubmit data. Current values:', {
          title: form.getValues(titleField),
          description: form.getValues(descriptionField),
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
