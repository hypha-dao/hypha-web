'use client';

import { CreateAgreementBaseFields, useTokens } from '@hypha-platform/epics';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  schemaIssueNewToken,
  createAgreementFiles,
  useMe,
  useCreateIssueTokenOrchestrator,
  Token,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { useJwt } from '@hypha-platform/core/client';
import { useConfig } from 'wagmi';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useRouter, useParams } from 'next/navigation';

type FormValues = z.infer<typeof schemaIssueNewToken>;

const fullSchemaIssueNewToken = schemaIssueNewToken
  .extend({ label: z.string().optional() })
  .extend(createAgreementFiles);

interface IssueNewTokenFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  plugin: React.ReactNode;
}

export const IssueNewTokenForm = ({
  successfulUrl,
  backUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: IssueNewTokenFormProps) => {
  const { id: spaceSlug } = useParams();
  const { tokens } = useTokens({ spaceSlug: spaceSlug as string });
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

  const [formError, setFormError] = React.useState<string | null>(null);

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
      iconUrl: undefined,
      type: undefined,
      maxSupply: 0,
      decaySettings: {
        decayInterval: 2592000,
        decayPercentage: 1,
      },
      label: 'Issue New Token',
      isVotingToken: false,
    },
    mode: 'onChange',
  });

  React.useEffect(() => {
    if (progress === 100 && agreementSlug) {
      router.push(successfulUrl);
    }
  }, [progress, agreementSlug, router, successfulUrl]);

  const handleCreate = async (data: FormValues) => {
    setFormError(null);

    const duplicateToken = tokens?.some(
      (token: Token) =>
        token.name?.toLowerCase() === data.name?.toLowerCase() &&
        token.symbol?.toLowerCase() === data.symbol?.toLowerCase(),
    );

    if (duplicateToken) {
      setFormError(
        'A token with the same name and symbol already exists in your space. Please modify either the name or symbol to proceed.',
      );
      return;
    }

    await createIssueToken({
      ...data,
      iconUrl: data.iconUrl || undefined,
      spaceId: spaceId as number,
      web3SpaceId: web3SpaceId as number,
      transferable: data.type !== 'voice',
      isVotingToken: false,
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
            backUrl={backUrl}
            backLabel="Back to settings"
            isLoading={false}
            label="Issue New Token"
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
