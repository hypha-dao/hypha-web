'use client';

import {
  schemaChangeSpaceTransparencySettings,
  useMe,
  useChangeSpaceTransparencySettingsOrchestrator,
  useJwt,
} from '@hypha-platform/core/client';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Form } from '@hypha-platform/ui';
import React from 'react';
import { useConfig } from 'wagmi';
import { CreateAgreementBaseFields } from '../../agreements';
import { useScrollToErrors } from '../../hooks';
import { TransparencyLevel } from '../../spaces/components/transparency-level';
import { useSpaceDiscoverability } from '../../spaces/hooks/use-space-discoverability';
import { useTranslations } from 'next-intl';
import { useLocalizedProposalResolver } from '../hooks/use-localized-proposal-resolver';

type FormValues = z.infer<typeof schemaChangeSpaceTransparencySettings>;

interface CreateProposalChangeSpaceTransparencySettingsFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  plugin: React.ReactNode;
}

export const CreateProposalChangeSpaceTransparencySettingsForm = ({
  successfulUrl,
  backUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: CreateProposalChangeSpaceTransparencySettingsFormProps) => {
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const {
    createChangeSpaceTransparencySettings,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
  } = useChangeSpaceTransparencySettingsOrchestrator({
    authToken: jwt,
    config,
  });
  const resolver = useLocalizedProposalResolver(
    schemaChangeSpaceTransparencySettings,
    tAgreementFlow,
  );

  const {
    discoverability,
    access,
    isLoading: isLoadingDiscoverability,
  } = useSpaceDiscoverability({
    spaceId: (web3SpaceId ?? spaceId ?? undefined) as number | undefined,
  });

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
      spaceDiscoverability: discoverability ?? TransparencyLevel.PUBLIC,
      spaceActivityAccess: access ?? TransparencyLevel.ORGANISATION,
      label: 'Space Transparency',
    },
  });

  React.useEffect(() => {
    if (!isLoadingDiscoverability) {
      if (discoverability !== undefined) {
        form.setValue('spaceDiscoverability', discoverability, {
          shouldDirty: false,
        });
      }
      if (access !== undefined) {
        form.setValue('spaceActivityAccess', access, { shouldDirty: false });
      }
    }
  }, [discoverability, access, isLoadingDiscoverability, form]);

  useScrollToErrors(form, formRef);

  const handleCreate = async (data: FormValues) => {
    await createChangeSpaceTransparencySettings({
      ...data,
      spaceId: spaceId as number,
      ...(typeof web3SpaceId === 'number' ? { web3SpaceId } : {}),
    });
  };

  const onInvalid = async (err: any) => {
    console.log('Invalid form:', err);
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
          onSubmit={form.handleSubmit(handleCreate, onInvalid)}
          className="flex flex-col gap-5"
        >
          <CreateAgreementBaseFields
            creator={{
              avatar: person?.avatarUrl || '',
              name: person?.name || '',
              surname: person?.surname || '',
            }}
            successfulUrl={successfulUrl}
            backUrl={backUrl}
            backLabel={tSpaces('backToSettings')}
            closeUrl={successfulUrl}
            isLoading={isPending}
            label={tAgreementFlow('labels.spaceTransparency')}
            progress={progress}
          />
          {plugin}
          <div className="flex justify-end w-full">
            <Button type="submit" disabled={isPending}>
              {tAgreementFlow('buttons.publish')}
            </Button>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
