'use client';

import { useForm } from 'react-hook-form';
import {
  schemaCreateAgreementWeb2,
  createAgreementFiles,
  useJwt,
  useMe,
  useCreateAirdropOrchestrator,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { useConfig } from 'wagmi';
import {
  useClearResubmitOnSuccess,
  useResubmitProposalData,
  useScrollToErrors,
} from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';
import { airdropSchema } from '../../agreements/plugins/airdrop/airdrop.validation';
import { useTranslations } from 'next-intl';
import { useLocalizedProposalResolver } from '../hooks/use-localized-proposal-resolver';

const AIRDROP_RESUBMIT_SEGMENT = 'airdrop';

const fullSchemaCreateAirdropForm = schemaCreateAgreementWeb2
  .extend(createAgreementFiles)
  .extend({ airdrop: airdropSchema });

type FormValues = z.infer<typeof fullSchemaCreateAirdropForm>;

interface CreateAirdropFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  plugin: React.ReactNode;
}

export const CreateAirdropForm = ({
  successfulUrl,
  backUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: CreateAirdropFormProps) => {
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const { createAirdrop, reset, currentAction, isError, isPending, progress } =
    useCreateAirdropOrchestrator({ authToken: jwt, config });
  const resolver = useLocalizedProposalResolver(
    fullSchemaCreateAirdropForm,
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
      airdrop: {
        method: 'transfer',
        token: '',
        recipients: [
          {
            recipient: '',
            amount: '',
          },
        ],
      },
    },
  });

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(
    form,
    spaceId,
    person?.id,
    AIRDROP_RESUBMIT_SEGMENT,
  );

  useClearResubmitOnSuccess(progress === 100 && !isError);

  const handleCreate = async (data: FormValues) => {
    if (typeof spaceId !== 'number') {
      console.error('Airdrop spaceId is missing');
      return;
    }

    const { method, token, recipients } = data.airdrop ?? {};
    if (!recipients || recipients.length === 0) {
      console.error('Airdrop recipients are missing');
      return;
    }

    // The token and method are chosen once; expand into one allocation per
    // recipient so each becomes a single mint/transfer action on execution.
    await createAirdrop({
      ...data,
      spaceId,
      web3SpaceId: typeof web3SpaceId === 'number' ? web3SpaceId : undefined,
      airdrop: recipients.map(({ recipient, amount }) => ({
        method,
        recipient,
        token: token ?? '',
        amount: amount ?? '0',
      })),
      label: 'Airdrop',
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
            label={tAgreementFlow('labels.airdrop')}
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
