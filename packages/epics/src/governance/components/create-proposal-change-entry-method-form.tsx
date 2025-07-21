'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Address,
  createAgreementFiles,
  EntryMethodType,
  schemaChangeEntryMethod,
  useChangeEntryMethodOrchestrator,
  useJwt,
  useMe,
  useSpaceDetailsWeb3Rpc,
} from '@hypha-platform/core/client';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useConfig } from 'wagmi';
import { z } from 'zod';
import { CreateAgreementBaseFields } from '@hypha-platform/epics';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';

const schemaCreateProposalChangeEntryMethod =
  schemaChangeEntryMethod.extend(createAgreementFiles);

type FormValues = z.infer<typeof schemaCreateProposalChangeEntryMethod>;

interface CreateProposalChangeEntryMethodFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  plugin: React.ReactNode;
}

const ENTRY_METHODS = [
  EntryMethodType.OPEN_ACCESS,
  EntryMethodType.TOKEN_BASED,
  EntryMethodType.INVITE_ONLY,
];

export const CreateProposalChangeEntryMethodForm = ({
  successfulUrl,
  backUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: CreateProposalChangeEntryMethodFormProps) => {
  const router = useRouter();
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const { spaceDetails, isLoading } = useSpaceDetailsWeb3Rpc({
    spaceId: web3SpaceId as number,
  });

  const {
    createChangeEntryMethod,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
    changeEntryMethod: { slug: agreementSlug },
  } = useChangeEntryMethodOrchestrator({ authToken: jwt, config });

  const defaultValues = React.useMemo(() => {
    return {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
      entryMethod: spaceDetails
        ? (Number(spaceDetails.joinMethod) as EntryMethodType)
        : EntryMethodType.OPEN_ACCESS,
      tokenBase: undefined,
      label: 'Entry Method',
    };
  }, [spaceId, person, spaceDetails]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schemaCreateProposalChangeEntryMethod),
    defaultValues: defaultValues,
  });

  React.useEffect(() => {
    if (spaceDetails && !isLoading) {
      const entryMethod =
        spaceDetails?.joinMethod ?? EntryMethodType.OPEN_ACCESS;
      form.setValue('entryMethod', Number(entryMethod));
    }
  }, [spaceDetails, isLoading]);

  const handleCreate = async (data: FormValues) => {
    if (
      !web3SpaceId ||
      spaceId === undefined ||
      !ENTRY_METHODS.includes(data.entryMethod)
    )
      return;

    try {
      await createChangeEntryMethod({
        ...data,
        spaceId: spaceId as number,
        web3SpaceId: web3SpaceId,
        entryMethod: data.entryMethod,
        tokenBase: data.tokenBase
          ? {
              amount: data.tokenBase.amount,
              token: data.tokenBase.token as Address,
            }
          : undefined,
      });
    } catch (error) {
      console.error('Error creating change entry method proposal:', error);
    }
  };

  const onInvalid = async (err: any) => {
    console.log('Invalid form:', err);
  };

  React.useEffect(() => {
    if (progress === 100 && agreementSlug) {
      router.push(successfulUrl);
    }
  }, [progress, agreementSlug, router, successfulUrl]);

  return (
    <LoadingBackdrop
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
          onSubmit={form.handleSubmit(handleCreate, onInvalid)}
          className="flex flex-col gap-5"
        >
          <CreateAgreementBaseFields
            creator={{
              avatar: person?.avatarUrl || '',
              name: person?.name || '',
              surname: person?.surname || '',
            }}
            backUrl={backUrl}
            backLabel="Back to Settings"
            closeUrl={successfulUrl}
            isLoading={false}
            label="Entry Method"
          />
          {plugin}
          <Separator />
          <div className="flex justify-end w-full">
            <Button type="submit">Publish</Button>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
