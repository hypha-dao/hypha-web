'use client';

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
import { useCreateRedeemTokensOrchestrator } from '@hypha-platform/core/client';
import { useRouter } from 'next/navigation';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useConfig } from 'wagmi';
import { useScrollToErrors, useResubmitProposalData } from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';
import { schemaRedeemTokens } from '../../agreements/plugins/redeem-tokens/validation';

const fullSchemaCreateRedeemTokensForm = schemaCreateAgreementForm
  .extend(createAgreementFiles)
  .extend(schemaRedeemTokens.shape);

type FormValues = z.infer<typeof fullSchemaCreateRedeemTokensForm>;

interface CreateRedeemTokensFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  plugin: React.ReactNode;
}

export const CreateRedeemTokensForm = ({
  successfulUrl,
  backUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: CreateRedeemTokensFormProps) => {
  const router = useRouter();
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const {
    createRedeemTokens,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
  } = useCreateRedeemTokensOrchestrator({ authToken: jwt, config });

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(fullSchemaCreateRedeemTokensForm),
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
      redemptions: [
        {
          token: '',
          amount: '',
        },
      ],
      conversions: [
        {
          asset: '',
          percentage: '100.00',
        },
      ],
    },
  });

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(form, spaceId, person?.id);

  const handleCreate = async (data: FormValues) => {
    if (!data.redemptions || data.redemptions.length === 0) {
      console.error('Redemptions are missing');
      return;
    }

    console.log('redeem-tokens data', {
      ...data,
      spaceId: spaceId as number,
      web3SpaceId: typeof web3SpaceId === 'number' ? web3SpaceId : undefined,
      redemptions: data.redemptions.map(({ amount, token }) => ({
        amount: amount ?? '0',
        token: token ?? '',
      })),
      conversions: data.conversions.map(({ asset, percentage }) => ({
        asset: asset ?? '',
        percentage: percentage ?? '0',
      })),
    });

    if (web3SpaceId === undefined) {
      console.error('Web3 space ID is missing');
      return;
    }

    const [redemption] = data.redemptions;
    if (!redemption) {
      console.error('Redemption is missing');
      return;
    }

    await createRedeemTokens({
      ...data,
      spaceId: spaceId as number,
      web3SpaceId: web3SpaceId as number,
      redemption: {
        amount: redemption.amount ?? '0',
        token: redemption.token ?? '',
      },
      conversions: data.conversions.map(({ asset, percentage }) => ({
        asset: asset ?? '',
        percentage: percentage ?? '0',
      })),
      label: 'Redeem Tokens',
    });
  };

  console.log('form errors:', form.formState.errors);

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
            key={resubmitKey}
            creator={{
              avatar: person?.avatarUrl || '',
              name: person?.name || '',
              surname: person?.surname || '',
            }}
            successfulUrl={successfulUrl}
            closeUrl={successfulUrl}
            backUrl={backUrl}
            isLoading={false}
            label="Redeem Tokens"
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
