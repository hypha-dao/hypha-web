'use client';

import { CreateAgreementBaseFields } from '@hypha-platform/epics';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  schemaCreateAgreementForm,
  createAgreementFiles,
  useMe,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';

type FormValues = z.infer<typeof schemaCreateAgreementForm>;

const schemaCreateProposalChangeVotingMethod =
  schemaCreateAgreementForm.extend(createAgreementFiles);

interface CreateProposalChangeVotingMethodFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  plugin: React.ReactNode;
}

export const CreateProposalChangeVotingMethodForm = ({
  successfulUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: CreateProposalChangeVotingMethodFormProps) => {
  const { person } = useMe();

  const form = useForm<FormValues>({
    resolver: zodResolver(schemaCreateProposalChangeVotingMethod),
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
    },
  });

  const handleCreate = async (data: FormValues) => {
    console.log('Create change voting method', data);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleCreate)}
        className="flex flex-col gap-5"
      >
        <CreateAgreementBaseFields
          creator={{
            avatar: person?.avatarUrl || '',
            name: person?.name || '',
            surname: person?.surname || '',
          }}
          closeUrl={successfulUrl}
          isLoading={false}
        />
        {plugin}
        <Separator />
        <div className="flex justify-end w-full">
          <Button type="submit">Publish</Button>
        </div>
      </form>
    </Form>
  );
};
