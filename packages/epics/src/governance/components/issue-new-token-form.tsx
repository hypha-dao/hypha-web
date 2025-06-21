'use client';

import { CreateAgreementBaseFields } from '@hypha-platform/epics';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  schemaIssueNewToken,
  createAgreementFiles,
  useMe,
  useCreateIssueTokenOrchestrator,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { useJwt } from '@hypha-platform/core/client';
import { useConfig } from 'wagmi';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useRouter } from 'next/navigation';

type FormValues = z.infer<typeof schemaIssueNewToken>;

const fullSchemaIssueNewToken =
  schemaIssueNewToken.extend(createAgreementFiles);

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
  const router = useRouter();
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const {
    createIssueToken,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
    agreement: { slug: agreementSlug },
  } = useCreateIssueTokenOrchestrator({ authToken: jwt, config });

  const form = useForm<FormValues>({
    resolver: zodResolver(fullSchemaIssueNewToken),
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
      // tokenDescription: '',
      decaySettings: {
        decayInterval: 604800,
        decayPercentage: 1,
      },
    },
  });

  React.useEffect(() => {
    if (progress === 100 && agreementSlug) {
      router.push(successfulUrl);
    }
  }, [progress, agreementSlug, router, successfulUrl]);

  const handleCreate = async (data: FormValues) => {
    await createIssueToken({
      ...data,
      spaceId: spaceId as number,
      web3SpaceId: web3SpaceId as number,
      transferable: data.type !== 'voice',
      isVotingToken: data.type === 'voice',
    });
  };

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
    </LoadingBackdrop>
  );
};
