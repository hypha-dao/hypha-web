'use client';

import { Separator, Form, Button } from '@hypha-platform/ui';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { CreateAgreementBaseFields } from '../../agreements';
import {
  useMe,
  createAgreementFiles,
  schemaChangeSpaceDelegate,
  Space,
  useChangeSpaceDelegateOrchestrator,
  useJwt,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { useConfig } from 'wagmi';
import React from 'react';
import { useSpaceTokenRequirementsByAddress } from '../hooks';
import {
  useClearResubmitOnSuccess,
  useResubmitProposalData,
  useScrollToErrors,
} from '../../hooks';
import { useTranslations } from 'next-intl';
import { useLocalizedProposalResolver } from '../hooks/use-localized-proposal-resolver';

const CHANGE_DELEGATE_RESUBMIT_SEGMENT = 'change-space-delegate';

interface ChangeSpaceDelegateFormProps {
  successfulUrl: string;
  backUrl?: string;
  children?: React.ReactNode;
  spaceId: number | undefined | null;
  web3SpaceId?: number | null;
  spaces?: Space[];
}

const combinedSchemaChangeSpaceDelegate =
  schemaChangeSpaceDelegate.extend(createAgreementFiles);
type FormValues = z.infer<typeof combinedSchemaChangeSpaceDelegate>;

export const ChangeSpaceDelegateForm = ({
  successfulUrl,
  backUrl,
  children,
  spaceId,
  web3SpaceId,
  spaces,
}: ChangeSpaceDelegateFormProps) => {
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { person } = useMe();
  const resolver = useLocalizedProposalResolver(
    combinedSchemaChangeSpaceDelegate,
    tAgreementFlow,
  );

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver,
    mode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      creatorId: person?.id,
      spaceId: spaceId ?? undefined,
      space: undefined,
      member: undefined,
      label: 'Change Delegate',
    },
  });

  React.useEffect(() => {
    if (person?.id) {
      form.setValue('creatorId', person.id, { shouldValidate: true });
    }
  }, [person?.id, form]);

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(
    form,
    spaceId,
    person?.id,
    CHANGE_DELEGATE_RESUBMIT_SEGMENT,
  );

  const { jwt } = useJwt();
  const config = useConfig();
  const {
    changeSpaceDelegateAction,
    reset,
    currentTask,
    isError,
    isPending,
    progress,
  } = useChangeSpaceDelegateOrchestrator({ authToken: jwt, config, spaces });

  const progressMessage =
    currentTask != null
      ? tAgreementFlow(`changeSpaceDelegateProgress.${currentTask}`)
      : null;

  useClearResubmitOnSuccess(progress === 100 && !isError);

  const spaceAddress = form.watch('space');

  const { hasTokenRequirements, hasEnoughTokens, missingTokenMessage } =
    useSpaceTokenRequirementsByAddress({
      spaceAddress,
      spaces,
    });

  const handleCreate = async (data: FormValues) => {
    if (!data.space || !data.member) return;

    if (spaceId == null || web3SpaceId == null) {
      return;
    }

    if (hasTokenRequirements && !hasEnoughTokens) {
      console.warn('Cannot submit proposal: not enough tokens.');
      return;
    }

    try {
      await changeSpaceDelegateAction({
        ...data,
        spaceId,
        web3SpaceId,
        space: data.space,
        member: data.member,
      });
    } catch (error) {
      console.error('Error creating change delegate proposal:', error);
    }
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
          <div>{progressMessage}</div>
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
            backLabel={tSpaces('backToSettings')}
            isLoading={false}
            label={tAgreementFlow('labels.changeDelegate')}
            progress={progress}
          />
          {children}

          <Separator />

          <div className="flex justify-end w-full">
            <Button
              disabled={hasTokenRequirements && !hasEnoughTokens}
              type="submit"
            >
              {tAgreementFlow('buttons.publish')}
            </Button>
          </div>

          {hasTokenRequirements && !hasEnoughTokens && (
            <div className="text-error-11 text-2">{missingTokenMessage}</div>
          )}
        </form>
      </Form>
    </SpaceLoadingBackdrop>
  );
};
