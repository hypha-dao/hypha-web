'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  baseSchemaIssueNewToken,
  createAgreementFiles,
  useMe,
  useUpdateIssuedTokenOrchestrator,
  DbToken,
  useJwt,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { useConfig } from 'wagmi';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useRouter } from 'next/navigation';
import {
  useDbTokens,
  useScrollToErrors,
  useResubmitProposalData,
} from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';

const extendedBaseSchema = baseSchemaIssueNewToken.merge(
  z.object({
    label: z.string().optional(),
    tokenAddress: z.string().optional(),
    archiveToken: z.boolean().optional(),
  }),
);

export const fullSchemaUpdateIssuedToken = extendedBaseSchema.superRefine(
  (data, ctx) => {
    if (data.enableLimitedSupply === true) {
      if (!data.maxSupplyType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please select a max supply type',
          path: ['maxSupplyType'],
        });
      }

      if (
        data.maxSupply === undefined ||
        data.maxSupply === null ||
        isNaN(data.maxSupply) ||
        data.maxSupply <= 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Enter a maximum supply greater than 0, or disable limited supply if you want unlimited supply.',
          path: ['maxSupply'],
        });
      }
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

type FormValues = z.infer<typeof fullSchemaUpdateIssuedToken>;

interface UpdateIssuedTokenFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  closeUrl?: string;
  plugin: React.ReactNode;
}

export const UpdateIssuedTokenForm = ({
  successfulUrl,
  backUrl,
  closeUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: UpdateIssuedTokenFormProps) => {
  const router = useRouter();
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const {
    updateIssuedToken,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
    agreement,
  } = useUpdateIssuedTokenOrchestrator({ authToken: jwt, config });

  const agreementSlug = agreement?.slug;

  const [formError, setFormError] = React.useState<string | null>(null);

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(fullSchemaUpdateIssuedToken),
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
      label: 'Update Token',
      isVotingToken: false,
      transferable: true,
      enableAdvancedTransferControls: false,
      transferWhitelist: undefined,
      enableProposalAutoMinting: true,
      enableLimitedSupply: false,
      maxSupplyType: undefined,
      enableTokenPrice: false,
      referenceCurrency: undefined,
      tokenPrice: undefined,
      tokenAddress: undefined,
      archiveToken: false,
    },
    mode: 'onChange',
  });

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(form, spaceId, person?.id);

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

    // No duplicate check needed for update
    await updateIssuedToken({
      ...data,
      iconUrl: data.iconUrl || undefined,
      spaceId: spaceId as number,
      web3SpaceId: web3SpaceId as number,
      transferable: data.transferable ?? data.type !== 'voice',
      isVotingToken: data.type === 'voice',
      referencePrice: data.enableTokenPrice ? data.tokenPrice : undefined,
      referenceCurrency: data.enableTokenPrice
        ? data.referenceCurrency
        : undefined,
      tokenAddress: data.tokenAddress,
      archiveToken: data.archiveToken,
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
            label="Update Token"
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
