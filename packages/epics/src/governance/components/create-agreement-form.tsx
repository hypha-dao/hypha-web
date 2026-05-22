'use client';

import { useForm } from 'react-hook-form';
import {
  schemaCreateAgreementForm,
  createAgreementFiles,
  useMe,
  useJwt,
  useCreateAgreementOrchestrator,
  DocumentState,
  SPACE_MEMORY_DOCUMENT_LABEL,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form } from '@hypha-platform/ui';
import React from 'react';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { useConfig } from 'wagmi';
import {
  useClearResubmitOnSuccess,
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
  /** Optional sticky-header title when it should differ from `label`. */
  stickyHeaderTitle?: string;
  /** Enables memory-first wording/behavior in the shared creation form. */
  mode?: 'agreement' | 'memory';
}

export const CreateAgreementForm = ({
  successfulUrl,
  backUrl,
  closeUrl,
  spaceId,
  web3SpaceId,
  label,
  stickyHeaderTitle,
  mode = 'agreement',
}: CreateAgreementFormProps) => {
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const tCoherence = useTranslations('CoherenceTab');
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
  } = useCreateAgreementOrchestrator({
    authToken: jwt,
    config,
    skipWeb3Proposal: mode === 'memory',
  });
  const resolver = useLocalizedProposalResolver(
    fullSchemaCreateSpaceForm,
    tAgreementFlow,
  );
  const resolvedLabel =
    mode === 'memory'
      ? SPACE_MEMORY_DOCUMENT_LABEL
      : label ?? tAgreementFlow('createActionForms.defaultAgreement');

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

  useClearResubmitOnSuccess(progress === 100 && !isError);

  const handleCreate = async (data: FormValues) => {
    await createAgreement({
      ...data,
      label: resolvedLabel,
      ...(mode === 'memory' ? { state: DocumentState.MEMORY } : {}),
      spaceId: spaceId as number,
      ...(mode === 'memory' || typeof web3SpaceId !== 'number'
        ? {}
        : { web3SpaceId }),
    });
  };

  const handleInvalid = async (err?: any) => {
    console.log('form errors:', err);
  };

  const loadingMessage = isError ? (
    <div className="flex flex-col">
      <div>{tSpaces('errorOhSnap')}</div>
      <Button onClick={reset}>{tSpaces('reset')}</Button>
    </div>
  ) : (
    <div>{currentAction}</div>
  );

  const formContent = (
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
          stickyHeaderTitle={stickyHeaderTitle}
          mode={mode}
          progress={progress}
        />
        <div className="flex justify-end w-full">
          <Button type="submit">
            {mode === 'memory'
              ? tCoherence.has('publish')
                ? tCoherence('publish')
                : tAgreementFlow('buttons.publish')
              : tAgreementFlow('buttons.publish')}
          </Button>
        </div>
      </form>
    </Form>
  );

  const sharedBackdropProps = {
    progress,
    isLoading: isPending,
    fullHeight: true as const,
    message: loadingMessage,
    children: formContent,
  };

  if (mode === 'memory') {
    return (
      <SpaceLoadingBackdrop
        showKeepWindowOpenMessage={false}
        {...sharedBackdropProps}
      />
    );
  }

  return (
    <SpaceLoadingBackdrop
      showKeepWindowOpenMessage
      keepWindowOpenMessage={tAgreementFlow('loadingBackdrop.keepWindowOpen')}
      {...sharedBackdropProps}
    />
  );
};
