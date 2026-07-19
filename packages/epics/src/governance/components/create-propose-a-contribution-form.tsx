'use client';

import { useForm } from 'react-hook-form';
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
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { useConfig } from 'wagmi';
import {
  clearResubmitProposalSessionStorage,
  useClearResubmitOnSuccess,
  useResubmitProposalData,
  useScrollToErrors,
} from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';
import { useTranslations } from 'next-intl';
import { useLocalizedProposalResolver } from '../hooks/use-localized-proposal-resolver';

const CONTRIBUTION_RESUBMIT_SEGMENT = 'propose-contribution';

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
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
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
  const resolver = useLocalizedProposalResolver(
    fullSchemaCreateProposeAContributionForm,
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
          amount: '',
          token: '',
        },
      ],
      paymentSchedule: {
        option: 'Immediately',
      },
      label: 'Contribution',
    },
  });

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(
    form,
    spaceId,
    person?.id,
    CONTRIBUTION_RESUBMIT_SEGMENT,
  );

  useClearResubmitOnSuccess(progress === 100 && !isError);

  React.useEffect(() => {
    if (progress === 100 && successfulUrl) {
      clearResubmitProposalSessionStorage();
      router.push(successfulUrl);
    }
  }, [progress, successfulUrl, router]);

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
      paymentSchedule: data.paymentSchedule,
    });
  };

  return (
    <SpaceLoadingBackdrop
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
            label={tAgreementFlow('labels.contribution')}
            progress={progress}
          />
          {plugin}
          <Separator />
          <div className="flex justify-end w-full">
            <Button type="submit">{tAgreementFlow('buttons.publish')}</Button>
          </div>
        </form>
      </Form>
    </SpaceLoadingBackdrop>
  );
};
