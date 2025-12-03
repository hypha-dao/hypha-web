'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  baseSchemaIssueNewToken,
  schemaIssueNewToken,
  createAgreementFiles,
  useMe,
  useCreateIssueTokenOrchestrator,
  DbToken,
  useJwt,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { useConfig } from 'wagmi';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useRouter } from 'next/navigation';
import { useDbTokens, useScrollToErrors } from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';

const extendedBaseSchema = baseSchemaIssueNewToken.merge(
  z.object({
    label: z.string().optional(),
  }),
);

export const fullSchemaIssueNewToken = extendedBaseSchema.superRefine(
  (data, ctx) => {
    if (data.maxSupply > 0 && !data.maxSupplyType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please select a max supply type',
        path: ['maxSupplyType'],
      });
    }

    if (data.enableTokenPrice) {
      if (!data.referenceCurrency) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please select a reference currency',
          path: ['referenceCurrency'],
        });
      }
      if (
        data.tokenPrice === undefined ||
        data.tokenPrice === null ||
        isNaN(data.tokenPrice) ||
        data.tokenPrice <= 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please enter a token price greater than 0',
          path: ['tokenPrice'],
        });
      }
    }
  },
);

type FormValues = z.infer<typeof fullSchemaIssueNewToken>;

interface IssueNewTokenFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  closeUrl?: string;
  plugin: React.ReactNode;
}

export const IssueNewTokenForm = ({
  successfulUrl,
  backUrl,
  closeUrl,
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
    agreement,
  } = useCreateIssueTokenOrchestrator({ authToken: jwt, config });

  const agreementSlug = agreement?.slug;

  const [formError, setFormError] = React.useState<string | null>(null);

  const formRef = React.useRef<HTMLFormElement>(null);
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
      transferable: true,
      enableAdvancedTransferControls: false,
      transferWhitelist: undefined,
      enableProposalAutoMinting: true,
      maxSupplyType: undefined,
      enableTokenPrice: false,
      referenceCurrency: undefined,
      tokenPrice: undefined,
    },
    mode: 'onChange',
  });

  useScrollToErrors(form, formRef);

  const { tokens: dbTokens, refetchDbTokens } = useDbTokens();

  const tokenType = form.watch('type');

  React.useEffect(() => {
    refetchDbTokens();
  }, [refetchDbTokens]);

  React.useEffect(() => {
    if (progress === 100 && agreementSlug) {
      router.push(successfulUrl);
    }
  }, [progress, agreementSlug, router, successfulUrl]);

  const handleCreate = async (data: FormValues) => {
    setFormError(null);

    const duplicateToken = dbTokens?.find((token: DbToken) => {
      const isNameEqual =
        token.name?.toLowerCase() === data.name?.toLowerCase();
      const isSymbolEqual =
        token.symbol?.toLowerCase() === data.symbol?.toLowerCase();
      const isSpaceEqual = token.spaceId === spaceId;
      return isNameEqual && isSymbolEqual && isSpaceEqual;
    });

    if (dbTokens?.length && duplicateToken) {
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
      isVotingToken: data.type === 'voice',
      referencePrice: data.enableTokenPrice ? data.tokenPrice : undefined,
      referenceCurrency: data.enableTokenPrice
        ? data.referenceCurrency
        : undefined,
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
            successfulUrl={successfulUrl}
            closeUrl={closeUrl || successfulUrl}
            backUrl={backUrl}
            backLabel="Back to settings"
            isLoading={false}
            label="Issue New Token"
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
