'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  schemaChangeSpaceTransparencySettings,
  useMe,
  useChangeSpaceTransparencySettingsOrchestrator,
  useJwt,
} from '@hypha-platform/core/client';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useConfig } from 'wagmi';
import { CreateAgreementBaseFields } from '../../agreements';
import { useScrollToErrors } from '../../hooks';
import { TransparencyLevel } from '../../spaces/components/transparency-level';

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
  const router = useRouter();
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
    changeSpaceTransparencySettings: agreement,
  } = useChangeSpaceTransparencySettingsOrchestrator({
    authToken: jwt,
    config,
  });

  const agreementSlug = agreement?.slug;

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schemaChangeSpaceTransparencySettings),
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
      spaceDiscoverability: TransparencyLevel.PUBLIC,
      spaceActivityAccess: TransparencyLevel.ORGANISATION,
      label: 'Space Transparency Configuration',
    },
  });

  useScrollToErrors(form, formRef);

  React.useEffect(() => {
    if (progress === 100 && agreementSlug) {
      router.push(successfulUrl);
    }
  }, [progress, agreementSlug, router, successfulUrl]);

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
      fullHeight={true}
      progress={progress}
      isLoading={isPending}
      message={
        isError ? (
          <div className="flex flex-col">
            <div>Ouh Snap. There was an error</div>
            <Button onClick={reset}>Reset</Button>
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
            backLabel="Back to Settings"
            closeUrl={successfulUrl}
            isLoading={isPending}
            label="Space Transparency Configuration"
            progress={progress}
          />
          {plugin}
          <div className="flex justify-end w-full">
            <Button type="submit" disabled={isPending}>
              Publish
            </Button>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
