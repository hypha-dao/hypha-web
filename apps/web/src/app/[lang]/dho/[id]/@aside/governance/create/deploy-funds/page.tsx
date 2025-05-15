/*'use client';

import { useParams } from 'next/navigation';
import { useMe } from '@hypha-platform/core/client';
import { Plugin } from '../plugins';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { schemaCreateAgreementForm } from '@hypha-platform/core/client';
import { z } from 'zod';
import React from 'react';
import { Button, Separator } from '@hypha-platform/ui';
import { CreateAgreementBaseFields, SidePanel } from '@hypha-platform/epics';
import { getDhoPathGovernance } from '../../../../@tab/governance/constants';
import { Locale } from '@hypha-platform/i18n';

type FormValues = z.infer<typeof schemaCreateAgreementForm>;

export default function CreateAgreement() {
  const { lang, id } = useParams<{ lang: Locale; id: string }>();
  const { person } = useMe();

  const form = useForm<FormValues>({
    resolver: zodResolver(schemaCreateAgreementForm),
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      recipient: '',
      payouts: [
        {
          amount: undefined,
          token: undefined,
        },
      ],
    },
  });

  const handleCreate = React.useCallback(
    async (data: z.infer<typeof schemaCreateAgreementForm>) => {
      // TODO: Implement deploy funds creation logic
      console.log('Creating deploy funds with data:', data);
    },
    [],
  );

  return (
    <SidePanel>
      <FormProvider {...form}>
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
            closeUrl={getDhoPathGovernance(lang, id)}
            isLoading={false}
            label="Funding"
          />
          <Plugin name="deploy-funds" />
          <Separator />
          <div className="flex justify-end w-full">
            <Button type="submit">Publish</Button>
          </div>
        </form>
      </FormProvider>
    </SidePanel>
  );
}*/
import { CreateDeployFundsForm, SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { createSpaceService } from '@core/space/server';
import { getDhoPathGovernance } from '../../../../@tab/governance/constants';
import { Plugin } from '../plugins';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function CreateDeployFundsPage({ params }: PageProps) {
  const { lang, id } = await params;

  const spaceService = createSpaceService();

  const spaceFromDb = await spaceService.getBySlug({ slug: id });

  if (!spaceFromDb) notFound();
  const { id: spaceId, web3SpaceId } = spaceFromDb;

  return (
    <SidePanel>
      <CreateDeployFundsForm
        successfulUrl={getDhoPathGovernance(lang as Locale, id)}
        spaceId={spaceId}
        web3SpaceId={web3SpaceId}
        plugin={<Plugin name="deploy-funds" />}
      />
    </SidePanel>
  );
}
