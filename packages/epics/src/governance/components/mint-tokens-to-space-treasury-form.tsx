'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  schemaMintTokensToSpaceTreasury,
  createAgreementFiles,
  useMe,
  useJwt,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { useConfig } from 'wagmi';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useRouter, useParams } from 'next/navigation';
import { useScrollToErrors } from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';

type FormValues = z.infer<typeof schemaMintTokensToSpaceTreasury>;

const fullSchemaMintTokensToSpaceTreasury = schemaMintTokensToSpaceTreasury
  .extend({ label: z.string().optional() })
  .extend(createAgreementFiles);

interface MintTokensToSpaceTreasuryFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  closeUrl?: string;
  plugin: React.ReactNode;
}

export const MintTokensToSpaceTreasuryForm = ({
  successfulUrl,
  backUrl,
  closeUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: MintTokensToSpaceTreasuryFormProps) => {
  const { id: spaceSlug } = useParams();
  const router = useRouter();
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();

  const [formError, setFormError] = React.useState<string | null>(null);

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(fullSchemaMintTokensToSpaceTreasury),
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
      label: 'Treasury Minting',
      mint: {
        amount: undefined,
        token: undefined,
      },
    },
    mode: 'onChange',
  });

  useScrollToErrors(form, formRef);

  const handleCreate = async (data: FormValues) => {
    setFormError(null);
  };

  return (
    <Form {...form}>
      <form
        ref={formRef}
        onSubmit={form.handleSubmit(handleCreate)}
        className="flex flex-col gap-5"
      >
        <CreateAgreementBaseFields
          creator={{
            avatar: person?.avatarUrl || '',
            name: person?.name || '',
            surname: person?.surname || '',
          }}
          closeUrl={closeUrl || successfulUrl}
          backUrl={backUrl}
          backLabel="Back to settings"
          isLoading={false}
          label="Treasury Minting"
        />
        {plugin}
        <Separator />
        <div className="flex flex-col gap-2">
          {formError && (
            <div className="text-error-11 text-2 font-medium">{formError}</div>
          )}
          <div className="flex justify-end w-full">
            <Button type="submit">Publish</Button>
          </div>
        </div>
      </form>
    </Form>
  );
};
