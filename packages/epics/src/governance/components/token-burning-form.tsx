'use client';

import { useForm } from 'react-hook-form';
import {
  schemaTokenBurning,
  createAgreementFiles,
  useMe,
  useJwt,
  useTokenBurningOrchestrator,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { useConfig } from 'wagmi';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useScrollToErrors, useResubmitProposalData } from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';
import { useTranslations } from 'next-intl';
import { useLocalizedProposalResolver } from '../hooks/use-localized-proposal-resolver';

type FormValues = z.infer<typeof schemaTokenBurning>;

const fullSchemaTokenBurning = schemaTokenBurning.extend(createAgreementFiles);

interface TokenBurningFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  closeUrl?: string;
  plugin: React.ReactNode;
}

export const TokenBurningForm = ({
  successfulUrl,
  backUrl,
  closeUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: TokenBurningFormProps) => {
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const {
    createTokenBurning,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
  } = useTokenBurningOrchestrator({
    authToken: jwt,
    config,
  });

  const resolver = useLocalizedProposalResolver(
    fullSchemaTokenBurning,
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
      label: 'Token Burning',
      tokenBurning: {
        token: '',
        burns: [
          {
            type: 'member',
            address: '',
            amount: '',
            allBalance: false,
          },
        ],
      },
    },
    mode: 'onChange',
  });

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(form, spaceId, person?.id);

  const handleCreate = async (data: FormValues) => {
    await createTokenBurning({
      ...data,
      spaceId: spaceId as number,
      web3SpaceId: web3SpaceId as number,
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
            closeUrl={closeUrl || successfulUrl}
            backUrl={backUrl}
            backLabel={tSpaces('backToSettings')}
            isLoading={false}
            label={tAgreementFlow('labels.tokenBurning')}
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
