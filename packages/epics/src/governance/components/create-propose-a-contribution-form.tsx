'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  schemaCreateAgreementForm,
  createAgreementFiles,
  useJwt,
  useMe,
  useCreateProposeAContributionOrchestrator,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { useRouter } from 'next/navigation';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useConfig } from 'wagmi';
import { useScrollToErrors } from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';

type FormValues = z.infer<typeof schemaCreateAgreementForm>;

const fullSchemaCreateProposeAContributionForm =
  schemaCreateAgreementForm.extend(createAgreementFiles);

interface CreateProposeAContributionFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  plugin: React.ReactNode;
}

export const CreateProposeAContributionForm = ({
  successfulUrl,
  backUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: CreateProposeAContributionFormProps) => {
  const router = useRouter();
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const {
    createProposeAContribution,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
  } = useCreateProposeAContributionOrchestrator({ authToken: jwt, config });

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(fullSchemaCreateProposeAContributionForm),
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
      recipient: '',
      payouts: [
        {
          amount: undefined,
          token: undefined,
        },
      ],
      label: 'Contribution',
    },
  });

  useScrollToErrors(form, formRef);

  const handleCreate = async (data: FormValues) => {
    if (!data.recipient || !data.payouts || data.payouts.length === 0) {
      console.error('Recipient or payouts are missing');
      return;
    }

    await createProposeAContribution({
      ...data,
      spaceId: spaceId as number,
      web3SpaceId: typeof web3SpaceId === 'number' ? web3SpaceId : undefined,
      recipient: data.recipient,
      payouts: data.payouts.map(({ amount, token }) => ({
        amount: String(amount ?? '0'),
        token: token ?? '',
      })),
    });
  };

  return (
    <LoadingBackdrop
      showKeepWindowOpenMessage={true}
      fullHeight={true}
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
    >
      <Form {...form}>
        <form
          ref={formRef}
          onSubmit={form.handleSubmit(handleCreate)}
          className="flex flex-col gap-5"
        >
          <CreateAgreementBaseFields
            creator={{
              avatar: person?.avatarUrl || '',
              name: person?.name || '',
              surname: person?.surname || '',
            }}
            successfulUrl={successfulUrl}
            closeUrl={successfulUrl}
            backUrl={backUrl}
            isLoading={false}
            label="Contribution"
            progress={progress}
          />
          {plugin}
          <Separator />
          <div className="flex justify-end w-full">
            <Button type="submit">Publish</Button>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
