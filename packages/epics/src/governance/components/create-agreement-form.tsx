'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  schemaCreateAgreementForm,
  createAgreementFiles,
  useMe,
  useJwt,
  useCreateAgreementOrchestrator,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form } from '@hypha-platform/ui';
import React from 'react';
import { useRouter } from 'next/navigation';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useConfig } from 'wagmi';
import { useScrollToErrors } from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';

type FormValues = z.infer<typeof schemaCreateAgreementForm>;

const fullSchemaCreateSpaceForm =
  schemaCreateAgreementForm.extend(createAgreementFiles);

interface CreateAgreementFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  closeUrl?: string;
  label?: string;
}

export const CreateAgreementForm = ({
  successfulUrl,
  backUrl,
  closeUrl,
  spaceId,
  web3SpaceId,
  label = 'Agreement',
}: CreateAgreementFormProps) => {
  const router = useRouter();
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const {
    createAgreement,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
  } = useCreateAgreementOrchestrator({ authToken: jwt, config });

  const formRef = React.useRef<HTMLFormElement>(null);

  const [resubmitKey, setResubmitKey] = React.useState(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(fullSchemaCreateSpaceForm),
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
    },
  });

  useScrollToErrors(form, formRef);

  const hasAppliedResubmitData = React.useRef(false);
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
              title: parsed.title || '',
              description: parsed.description || '',
              leadImage: undefined,
              attachments: undefined,
              spaceId: spaceId ?? undefined,
              creatorId: person?.id,
            },
            {
              keepDefaultValues: false,
            },
          );

          form.setValue('title', parsed.title || '', {
            shouldDirty: true,
            shouldValidate: true,
          });
          form.setValue('description', parsed.description || '', {
            shouldDirty: true,
            shouldValidate: true,
          });

          if (parsed.attachments && parsed.attachments.length > 0) {
            form.setValue('attachments', parsed.attachments as any, {
              shouldDirty: true,
              shouldValidate: false,
            });
          }

          if (parsed.leadImage && typeof parsed.leadImage === 'string') {
            form.setValue('leadImage', parsed.leadImage as any, {
              shouldDirty: true,
              shouldValidate: false,
            });
          }

          form.trigger(['title', 'description']);

          setResubmitKey((prev) => prev + 1);

          hasAppliedResubmitData.current = true;

          sessionStorage.removeItem('resubmitProposalData');

          console.log('Form reset with resubmit data. Current values:', {
            title: form.getValues('title'),
            description: form.getValues('description'),
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
  }, [form, spaceId, person?.id]);

  const handleCreate = async (data: FormValues) => {
    await createAgreement({
      ...data,
      label: label,
      spaceId: spaceId as number,
      ...(typeof web3SpaceId === 'number' ? { web3SpaceId } : {}),
    });
  };

  const handleInvalid = async (err?: any) => {
    console.log('form errors:', err);
  };

  return (
    <LoadingBackdrop
      showKeepWindowOpenMessage={true}
      progress={progress}
      isLoading={isPending}
      fullHeight={true}
      message={
        isError ? (
          <div className="flex flex-col">
            <div>Ouh Snap. There was an error</div>
            <Button onClick={reset}>Reset</Button>
          </div>
        ) : (
          <div>{currentAction}</div>
        )
      }
    >
      <Form {...form}>
        <form
          ref={formRef}
          onSubmit={form.handleSubmit(handleCreate, handleInvalid)}
          className="flex flex-col gap-5"
        >
          <CreateAgreementBaseFields
            key={resubmitKey}
            creator={{
              avatar: person?.avatarUrl || '',
              name: person?.name || '',
              surname: person?.surname || '',
            }}
            successfulUrl={successfulUrl}
            closeUrl={closeUrl || successfulUrl}
            backUrl={backUrl}
            isLoading={false}
            label={label}
            progress={progress}
          />
          <div className="flex justify-end w-full">
            <Button type="submit">Publish</Button>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
