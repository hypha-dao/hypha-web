'use client';

import { useForm } from 'react-hook-form';
import {
  schemaCreateAgreementForm,
  createAgreementFiles,
  useJwt,
  useMe,
  useCreatePayForExpensesOrchestrator,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useConfig } from 'wagmi';
import {
  useClearResubmitOnSuccess,
  useResubmitProposalData,
  useScrollToErrors,
} from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';
import { useTranslations } from 'next-intl';
import { useLocalizedProposalResolver } from '../hooks/use-localized-proposal-resolver';

const EXPENSES_RESUBMIT_SEGMENT = 'pay-for-expenses';

const fullSchemaCreatePayForExpensesForm =
  schemaCreateAgreementForm.extend(createAgreementFiles);

type FormValues = z.infer<typeof fullSchemaCreatePayForExpensesForm>;

interface CreatePayForExpensesFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  plugin: React.ReactNode;
}

export const CreatePayForExpensesForm = ({
  successfulUrl,
  backUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: CreatePayForExpensesFormProps) => {
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const {
    createPayForExpenses,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
  } = useCreatePayForExpensesOrchestrator({ authToken: jwt, config });
  const resolver = useLocalizedProposalResolver(
    fullSchemaCreatePayForExpensesForm,
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
  const { resubmitKey } = useResubmitProposalData(
    form,
    spaceId,
    person?.id,
    EXPENSES_RESUBMIT_SEGMENT,
  );

  useClearResubmitOnSuccess(progress === 100 && !isError);

  const handleCreate = async (data: FormValues) => {
    if (!data.recipient || !data.payouts || data.payouts.length === 0) {
      console.error('Recipient or payouts are missing');
      return;
    }

    console.log('pay-for-expenses data', {
      ...data,
      spaceId: spaceId as number,
      web3SpaceId: typeof web3SpaceId === 'number' ? web3SpaceId : undefined,
      recipient: data.recipient,
      payouts: data.payouts.map(({ amount, token }) => ({
        amount: amount ?? '0',
        token: token ?? '',
      })),
    });

    await createPayForExpenses({
      ...data,
      spaceId: spaceId as number,
      web3SpaceId: typeof web3SpaceId === 'number' ? web3SpaceId : undefined,
      recipient: data.recipient,
      payouts: data.payouts.map(({ amount, token }) => ({
        amount: amount ?? '0',
        token: token ?? '',
      })),
      label: 'Expenses',
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
            label={tAgreementFlow('labels.expenses')}
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
