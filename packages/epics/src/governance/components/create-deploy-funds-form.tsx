'use client';

import { CreateAgreementBaseFields } from '@hypha-platform/epics';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  schemaCreateAgreementForm,
  createAgreementFiles,
  useJwt,
  useMe,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { useCreateDeployFundsOrchestrator } from '@hypha-platform/core/client';
import { useRouter } from 'next/navigation';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useConfig } from 'wagmi';

type FormValues = z.infer<typeof schemaCreateAgreementForm>;

const fullSchemaCreateDeployFundsForm =
  schemaCreateAgreementForm.extend(createAgreementFiles);

interface CreateDeployFundsFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  plugin: React.ReactNode;
}

export const CreateDeployFundsForm = ({
  successfulUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: CreateDeployFundsFormProps) => {
  const router = useRouter();
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const {
    createDeployFunds,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
    agreement: { slug: agreementSlug },
  } = useCreateDeployFundsOrchestrator({ authToken: jwt, config });

  const form = useForm<FormValues>({
    resolver: zodResolver(fullSchemaCreateDeployFundsForm),
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
    },
  });

  console.log(form);

  React.useEffect(() => {
    if (progress === 100 && agreementSlug) {
      router.push(successfulUrl);
    }
  }, [progress, agreementSlug]);

  const handleCreate = async (data: FormValues) => {
    if (!data.recipient || !data.payouts || data.payouts.length === 0) {
      console.error('Recipient or payouts are missing');
      return;
    }

    console.log('deploy-funds data', {
      ...data,
      spaceId: spaceId as number,
      web3SpaceId: typeof web3SpaceId === 'number' ? web3SpaceId : undefined,
      recipient: data.recipient,
      payouts: data.payouts.map(({ amount, token }) => ({
        amount: String(amount ?? '0'),
        token: token ?? '',
      })),
    });

    await createDeployFunds({
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
            label="Funding"
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
