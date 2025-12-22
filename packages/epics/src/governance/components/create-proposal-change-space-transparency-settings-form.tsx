'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  schemaChangeSpaceTransparencySettings,
  useMe,
} from '@hypha-platform/core/client';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
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
  const { person } = useMe();

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

  const handleCreate = async (data: FormValues) => {
    // TODO: Implement orchestrator logic here
    console.log('Form data:', data);
  };

  const onInvalid = async (err: any) => {
    console.log('Invalid form:', err);
  };

  return (
    <LoadingBackdrop
      showKeepWindowOpenMessage={true}
      fullHeight={true}
      progress={0}
      isLoading={false}
      // message={null}
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
            isLoading={false}
            label="Space Transparency Configuration"
            progress={0}
          />
          {plugin}
          <div className="flex justify-end w-full">
            <Button type="submit">Publish</Button>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
