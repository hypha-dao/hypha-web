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

const schemaIssueNewToken =
  schemaCreateAgreementForm.extend(createAgreementFiles);

interface IssueNewTokenFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  plugin: React.ReactNode;
}

export const IssueNewTokenForm = ({
  successfulUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: IssueNewTokenFormProps) => {
  const { person } = useMe();

  const form = useForm<FormValues>({
    resolver: zodResolver(schemaIssueNewToken),
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
      name: '',
      symbol: '',
      icon: undefined,
      // digits: 0,
      type: undefined,
      maxSupply: 0,
      tokenDescription: '',
    },
  });

  const handleCreate = async (data: FormValues) => {
    console.log('Issue new token', data);
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
