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
