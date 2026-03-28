'use client';

import { useForm } from 'react-hook-form';
import {
  createAgreementFiles,
  schemaExchangeStakesAndTokens,
  useCreateExchangeStakesAndTokensOrchestrator,
  useJwt,
  useMe,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useConfig } from 'wagmi';
import { useScrollToErrors, useResubmitProposalData } from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';
import { useTranslations } from 'next-intl';
import { useLocalizedProposalResolver } from '../hooks/use-localized-proposal-resolver';

const fullSchemaCreateExchangeStakesAndTokensForm =
  schemaExchangeStakesAndTokens.extend(createAgreementFiles);

type FormValues = z.infer<typeof fullSchemaCreateExchangeStakesAndTokensForm>;

interface CreateExchangeStakesAndTokensFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  plugin: React.ReactNode;
}

export const CreateExchangeStakesAndTokensForm = ({
  successfulUrl,
  backUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: CreateExchangeStakesAndTokensFormProps) => {
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();

  const {
    createExchangeStakesAndTokens,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
  } = useCreateExchangeStakesAndTokensOrchestrator({ authToken: jwt, config });

  const resolver = useLocalizedProposalResolver(
    fullSchemaCreateExchangeStakesAndTokensForm,
    tAgreementFlow,
  );

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver,
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
      sellerAddress: '',
      buyerAddress: '',
      sellerLeg: { amount: '', token: '' },
      buyerLeg: { amount: '', token: '' },
      label: 'Exchange',
    },
  });

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(form, spaceId, person?.id);

  const handleCreate = async (data: FormValues) => {
    await createExchangeStakesAndTokens({
      ...data,
      spaceId: spaceId as number,
      web3SpaceId: typeof web3SpaceId === 'number' ? web3SpaceId : undefined,
      label: 'Exchange',
    });
  };

  return (
    <LoadingBackdrop
      showKeepWindowOpenMessage={true}
      keepWindowOpenMessage={tAgreementFlow('loadingBackdrop.keepWindowOpen')}
      fullHeight={true}
      progress={progress}
      isLoading={isPending}
      message={
        isError ? (
          <div className="flex flex-col">
            <div>{tSpaces('errorOhSnap')}</div>
            <Button onClick={reset}>{tSpaces('reset')}</Button>
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
            label={tAgreementFlow('labels.exchange')}
            progress={progress}
          />
          {plugin}
          <Separator />
          <div className="flex justify-end w-full">
            <Button type="submit">{tAgreementFlow('buttons.publish')}</Button>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
