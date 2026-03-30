'use client';

import { useForm } from 'react-hook-form';
import {
  schemaAcceptInvestment,
  useJwt,
  useMe,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { useCreateAcceptInvestmentOrchestrator } from '@hypha-platform/core/client';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useConfig } from 'wagmi';
import { useScrollToErrors, useResubmitProposalData } from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';
import { useTranslations } from 'next-intl';
import { useLocalizedProposalResolver } from '../hooks/use-localized-proposal-resolver';

const fullSchemaCreateAcceptInvestmentForm = schemaAcceptInvestment;

type FormValues = z.infer<typeof fullSchemaCreateAcceptInvestmentForm>;

interface CreateAcceptInvestmentFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  plugin: React.ReactNode;
}

export const CreateAcceptInvestmentForm = ({
  successfulUrl,
  backUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: CreateAcceptInvestmentFormProps) => {
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const {
    createAcceptInvestment,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
  } = useCreateAcceptInvestmentOrchestrator({ authToken: jwt, config });
  const resolver = useLocalizedProposalResolver(
    fullSchemaCreateAcceptInvestmentForm,
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
      label: 'Investment',
      recipient: '',
      investorSendLegs: [{ amount: '', token: '' as `0x${string}` }],
    },
  });

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(form, spaceId, person?.id);

  const handleCreate = async (data: FormValues) => {
    await createAcceptInvestment({
      ...data,
      spaceId: spaceId as number,
      web3SpaceId: typeof web3SpaceId === 'number' ? web3SpaceId : undefined,
      label: 'Investment',
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
            label={tAgreementFlow('labels.investment')}
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
