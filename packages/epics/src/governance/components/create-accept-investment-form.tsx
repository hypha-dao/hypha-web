'use client';

import React, { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import {
  schemaAcceptInvestment,
  useJwt,
  useMe,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
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
    errors: orchestratorErrors,
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
      spaceReceiveLegs: [{ amount: '', token: '' as `0x${string}` }],
    },
  });

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(form, spaceId, person?.id);

  const tAcceptForm = useTranslations('AgreementFlow.acceptInvestmentForm');

  const submitErrorMessage = useMemo(() => {
    const first = orchestratorErrors[0];
    const raw =
      first instanceof Error
        ? first.message
        : typeof first === 'string'
        ? first
        : '';
    if (!raw) return '';
    if (/NotMember/i.test(raw)) return tAcceptForm('notMemberRevert');
    if (/rejected|denied|user rejected|cancelled/i.test(raw))
      return tAcceptForm('walletRejected');
    if (
      /HYPHA_ESCROW_ADDRESS_MISSING|NEXT_PUBLIC_ESCROW_IMPLEMENTATION_ADDRESS/i.test(
        raw,
      )
    ) {
      return tAcceptForm('escrowNotConfigured');
    }
    return raw;
  }, [orchestratorErrors, tAcceptForm]);

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
          <div className="flex flex-col gap-3 items-stretch max-w-md mx-auto px-2">
            <div className="text-center">{tSpaces('errorOhSnap')}</div>
            {submitErrorMessage ? (
              <div className="text-sm text-neutral-11 text-center break-words">
                {submitErrorMessage}
              </div>
            ) : null}
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
          <p className="text-2 text-neutral-11 px-1">
            {tAcceptForm('proposerHint')}
          </p>
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
