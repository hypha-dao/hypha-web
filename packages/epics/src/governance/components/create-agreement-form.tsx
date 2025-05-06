'use client';

import { CreateAgreementBaseFields } from '@hypha-platform/epics';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  schemaCreateAgreementForm,
  createAgreementFiles,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button } from '@hypha-platform/ui';
import React from 'react';
import { useCreateAgreementOrchestrator } from '@hypha-platform/core/client';
import { useRouter } from 'next/navigation';
import { useJwt } from '@hypha-platform/core/client';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { Form } from '@hypha-platform/ui';
import { useMe } from '@hypha-platform/core/client';
import { useConfig } from 'wagmi';

type FormValues = z.infer<typeof schemaCreateAgreementForm>;

const fullSchemaCreateSpaceForm =
  schemaCreateAgreementForm.extend(createAgreementFiles);

interface CreateAgreementFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
}

export const CreateAgreementForm = ({
  successfulUrl,
  spaceId,
  web3SpaceId,
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
    agreement: { slug: agreementSlug },
  } = useCreateAgreementOrchestrator({ authToken: jwt, config });

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

  console.log(form);

  React.useEffect(() => {
    if (progress === 100 && agreementSlug) {
      router.push(successfulUrl);
    }
  }, [progress, agreementSlug]);

  const handleCreate = async (data: FormValues) => {
    await createAgreement({
      ...data,
      spaceId: spaceId as number,
      ...(typeof web3SpaceId === 'number' ? { web3SpaceId } : {}),
    });
  };

  console.log('form errors:', form.formState.errors);

  return (
    <LoadingBackdrop
      progress={progress}
      isLoading={isPending}
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
      className="-m-9"
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleCreate)}
          className="flex flex-col gap-5"
        >
          <CreateAgreementBaseFields
            creator={{
              avatar: person?.avatarUrl || '',
              name: person?.name || '',
              surname: person?.surname || '',
            }}
            closeUrl={successfulUrl}
            isLoading={false}
          />
          <div className="flex justify-end w-full">
            <Button type="submit">Publish</Button>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
