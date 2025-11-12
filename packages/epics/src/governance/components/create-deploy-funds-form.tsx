'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  schemaCreateAgreementForm,
  createAgreementFiles,
  useJwt,
  useMe,
  useHookRegistry,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { useCreateDeployFundsOrchestrator } from '@hypha-platform/core/client';
import { useRouter } from 'next/navigation';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useConfig } from 'wagmi';
import { useScrollToErrors } from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';

const fullSchemaCreateDeployFundsForm =
  schemaCreateAgreementForm.extend(createAgreementFiles);

type FormValues = z.infer<typeof fullSchemaCreateDeployFundsForm>;

interface CreateDeployFundsFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  plugin: React.ReactNode;
}

export const CreateDeployFundsForm = ({
  successfulUrl,
  backUrl,
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
    agreement: { slug: agreementSlug, proposalId: web3ProposalId, creator },
  } = useCreateDeployFundsOrchestrator({ authToken: jwt, config });
  const { useSendNotifications } = useHookRegistry();
  const { notifyProposalCreated } = useSendNotifications!({ authToken: jwt });

  const formRef = React.useRef<HTMLFormElement>(null);
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

  useScrollToErrors(form, formRef);

  React.useEffect(() => {
    if (
      progress === 100 &&
      agreementSlug &&
      web3ProposalId &&
      web3SpaceId &&
      creator
    ) {
      notifyProposalCreated({
        proposalId: web3ProposalId,
        spaceId: BigInt(web3SpaceId),
        creator,
      });
      router.push(successfulUrl);
    }
  }, [
    progress,
    agreementSlug,
    web3ProposalId,
    web3SpaceId,
    creator,
    router,
    successfulUrl,
  ]);

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
        amount: amount ?? '0',
        token: token ?? '',
      })),
    });

    await createDeployFunds({
      ...data,
      spaceId: spaceId as number,
      web3SpaceId: typeof web3SpaceId === 'number' ? web3SpaceId : undefined,
      recipient: data.recipient,
      payouts: data.payouts.map(({ amount, token }) => ({
        amount: amount ?? '0',
        token: token ?? '',
      })),
      label: 'Funding',
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
            closeUrl={successfulUrl}
            backUrl={backUrl}
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
