'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  schemaTokenBackingVault,
  createAgreementFiles,
  useMe,
} from '@hypha-platform/core/client';
import { useCreateTokenBackingVaultOrchestratorStub } from './useTokenBackingVaultOrchestratorStub';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useRouter } from 'next/navigation';
import { useScrollToErrors, useResubmitProposalData } from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';

const fullSchemaTokenBackingVault =
  schemaTokenBackingVault.extend(createAgreementFiles);

type FormValues = z.infer<typeof fullSchemaTokenBackingVault>;

interface CreateProposalTokenBackingVaultFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  closeUrl?: string;
  plugin: React.ReactNode;
}

export const CreateProposalTokenBackingVaultForm = ({
  successfulUrl,
  backUrl,
  closeUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: CreateProposalTokenBackingVaultFormProps) => {
  const router = useRouter();
  const { person } = useMe();
  const {
    createTokenBackingVault,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
  } = useCreateTokenBackingVaultOrchestratorStub();

  const [formError, setFormError] = React.useState<string | null>(null);

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(fullSchemaTokenBackingVault),
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
      label: 'Backing Vault',
      tokenBackingVault: {
        spaceToken: '',
        activateVault: true,
        enableRedemption: false,
        addCollaterals: [],
        removeCollaterals: [],
        referenceCurrency: undefined,
        tokenPrice: undefined,
        minimumBackingPercent: 0,
        maxRedemptionPercent: undefined,
        maxRedemptionPeriodDays: undefined,
        redemptionStartDate: null,
        enableAdvancedRedemptionControls: false,
        redemptionWhitelist: [],
      },
    },
    mode: 'onChange',
  });

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(form, spaceId, person?.id);

  const handleCreate = async (data: FormValues) => {
    setFormError(null);
    await createTokenBackingVault({
      ...data,
      spaceId: spaceId as number,
      web3SpaceId: web3SpaceId as number,
    });
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
            closeUrl={closeUrl || successfulUrl}
            backUrl={backUrl}
            backLabel="Back to settings"
            isLoading={false}
            label="Backing Vault"
            progress={progress}
          />
          {plugin}
          <Separator />
          <div className="flex flex-col gap-2">
            {formError && (
              <div className="text-error-11 text-2 font-medium">
                {formError}
              </div>
            )}
            <div className="flex justify-end w-full">
              <Button type="submit">Publish</Button>
            </div>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
