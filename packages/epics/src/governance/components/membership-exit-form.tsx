'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  createAgreementFiles,
  schemaMembershipExit,
  Space,
  useJwt,
  useMe,
  useMembershipExitOrchestrator,
} from '@hypha-platform/core/client';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useScrollToErrors, useResubmitProposalData } from '../../hooks';
import { useConfig } from 'wagmi';
import { Button, Form, LoadingBackdrop, Separator } from '@hypha-platform/ui';
import { CreateAgreementBaseFields } from '../../agreements';
import { useTranslations } from 'next-intl';

const combinedSchemaMembershipExit =
  schemaMembershipExit.extend(createAgreementFiles);
type FormValues = z.infer<typeof combinedSchemaMembershipExit>;

interface MembershipExitFormProps {
  spaceId: number | undefined | null;
  web3SpaceId?: number | null;
  successfulUrl: string;
  backUrl?: string;
  plugin: React.ReactNode;
}

export const MembershipExitForm = ({
  successfulUrl,
  backUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: MembershipExitFormProps) => {
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { person, isLoading: isPersonLoading } = useMe();

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(combinedSchemaMembershipExit),
    mode: 'onChange',
    defaultValues: {
      label: tAgreementFlow('labels.membershipExit'),
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
      space: web3SpaceId ?? undefined,
      member: undefined,
    },
  });

  React.useEffect(() => {
    if (isPersonLoading || !person) {
      return;
    }
    form.setValue('creatorId', person.id);
  }, [isPersonLoading, person, form]);

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(form, spaceId, person?.id);

  const { jwt } = useJwt();
  const config = useConfig();
  const {
    membershipExitAction,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
  } = useMembershipExitOrchestrator({ authToken: jwt, config });

  const handleCreate = React.useCallback(
    async (data: FormValues) => {
      if (!data.space || !data.member) {
        return;
      }

      try {
        await membershipExitAction({
          ...data,
          web3SpaceId: data.space,
          member: data.member,
        });
      } catch (error) {
        console.error('Error creating membership exit proposal:', error);
      }
    },
    [membershipExitAction],
  );

  const handleInvalid = async (err?: any) => {
    console.warn('Error on Member Exit:', err);
  };

  return (
    <LoadingBackdrop
      showKeepWindowOpenMessage={true}
      fullHeight={true}
      progress={progress}
      isLoading={isPending}
      message={
        isError ? (
          <div>
            <div className="flex flex-col">
              <div>{tSpaces('errorOhSnap')}</div>
              <Button onClick={reset}>{tSpaces('reset')}</Button>
            </div>
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
            closeUrl={successfulUrl}
            backUrl={backUrl}
            backLabel={tSpaces('backToSettings')}
            isLoading={false}
            label={tAgreementFlow('labels.membershipExit')}
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
