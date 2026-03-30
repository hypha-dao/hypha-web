'use client';

import { useForm } from 'react-hook-form';
import {
  schemaCreateAgreementForm,
  createAgreementFiles,
  useMe,
  useJwt,
  useCreateAgreementOrchestrator,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form } from '@hypha-platform/ui';
import React from 'react';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useConfig } from 'wagmi';
import {
  clearResubmitProposalSessionStorage,
  useResubmitProposalData,
  useScrollToErrors,
} from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';
import { useTranslations } from 'next-intl';
import { useLocalizedProposalResolver } from '../hooks/use-localized-proposal-resolver';

const COLLECTIVE_AGREEMENT_RESUBMIT_SEGMENT = '';

type FormValues = z.infer<typeof schemaCreateAgreementForm>;

const fullSchemaCreateSpaceForm =
  schemaCreateAgreementForm.extend(createAgreementFiles);

interface CreateAgreementFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  closeUrl?: string;
  label?: string;
}

export const CreateAgreementForm = ({
  successfulUrl,
  backUrl,
  closeUrl,
  spaceId,
  web3SpaceId,
  label,
}: CreateAgreementFormProps) => {
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const {
    createAgreement,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
  } = useCreateAgreementOrchestrator({ authToken: jwt, config });
  const resolver = useLocalizedProposalResolver(
    fullSchemaCreateSpaceForm,
    tAgreementFlow,
  );
  const resolvedLabel =
    label ?? tAgreementFlow('createActionForms.defaultAgreement');

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
    },
  });

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(
    form,
    spaceId,
    person?.id,
    COLLECTIVE_AGREEMENT_RESUBMIT_SEGMENT,
  );

  React.useEffect(() => {
    if (progress === 100 && !isError) {
      clearResubmitProposalSessionStorage();
    }
  }, [progress, isError]);

  const handleCreate = async (data: FormValues) => {
    await createAgreement({
      ...data,
      label: resolvedLabel,
      spaceId: spaceId as number,
      ...(typeof web3SpaceId === 'number' ? { web3SpaceId } : {}),
    });
  };

  const handleInvalid = async (err?: any) => {
    console.log('form errors:', err);
  };

  return (
    <LoadingBackdrop
      showKeepWindowOpenMessage={true}
      keepWindowOpenMessage={tAgreementFlow('loadingBackdrop.keepWindowOpen')}
      progress={progress}
      isLoading={isPending}
      fullHeight={true}
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
          onSubmit={form.handleSubmit(handleCreate, handleInvalid)}
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
            isLoading={false}
            label={resolvedLabel}
            progress={progress}
          />
          <div className="flex justify-end w-full">
            <Button type="submit">{tAgreementFlow('buttons.publish')}</Button>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
