'use client';

import { FieldErrors, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  baseSchemaIssueNewToken,
  useMe,
  useUpdateIssuedTokenOrchestrator,
  useJwt,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { useConfig } from 'wagmi';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import {
  useDbTokens,
  useScrollToErrors,
  useResubmitProposalData,
} from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

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
  const tSpaces = useTranslations('Spaces');
  const tCommon = useTranslations('Common');

  const fullSchemaUpdateIssuedToken = React.useMemo(() => {
    const extendedBaseSchema = baseSchemaIssueNewToken.merge(
      z.object({
        label: z.string().optional(),
        tokenAddress: z.string({ message: tSpaces('tokenShouldBeChosen') }),
        archiveToken: z.boolean().optional(),
      }),
    );

    return extendedBaseSchema.superRefine((data, ctx) => {
      if (data.enableLimitedSupply === true) {
        if (
          data.maxSupply === undefined ||
          data.maxSupply === null ||
          isNaN(data.maxSupply) ||
          data.maxSupply <= 0
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: tSpaces('maxSupplyValidation'),
            path: ['maxSupply'],
          });
        }
      }

      if (data.enableTokenPrice) {
        if (!data.referenceCurrency) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: tSpaces('selectReferenceCurrency'),
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
            message: tSpaces('tokenPriceGreaterThanZero'),
            path: ['tokenPrice'],
          });
        }
      }
    });
  }, [tSpaces]);

  type FormValues = z.infer<typeof fullSchemaUpdateIssuedToken>;

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
      label: 'Update Token',
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
      isVotingToken: false,
      transferable: true,
      enableAdvancedTransferControls: false,
      transferWhitelist: undefined,
      enableProposalAutoMinting: true,
      enableLimitedSupply: false,
      enableTokenPrice: false,
      referenceCurrency: undefined,
      tokenPrice: undefined,
      tokenAddress: undefined,
      archiveToken: false,
    },
    mode: 'onChange',
  });
  const { dirtyFields } = form.formState;

  const { refetchDbTokens } = useDbTokens();

  React.useEffect(() => {
    if (progress === 100 && agreementSlug) {
      router.push(successfulUrl);
    }
  }, [progress, agreementSlug, router, successfulUrl]);

  const filterChangedFormFields = (allFields: FormValues) => {
    const changedFieldValues: { [x: string]: unknown } = {};

    Object.keys(dirtyFields).forEach((fieldKey) => {
      const key = fieldKey as keyof FormValues;
      if (typeof dirtyFields[key] === 'object' && dirtyFields[key] !== null) {
        changedFieldValues[fieldKey] = allFields[key];
      } else if (dirtyFields[key] === true) {
        changedFieldValues[key] = allFields[key];
      }
    });
    return changedFieldValues as FormValues;
  };

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(form, spaceId, person?.id);

  React.useEffect(() => {
    refetchDbTokens();
  }, [refetchDbTokens]);

  React.useEffect(() => {
    if (!person?.id) {
      return;
    }
    form.setValue('creatorId', person?.id);
  }, [person]);

  React.useEffect(() => {
    if (spaceId === undefined || spaceId === null) {
      return;
    }
    form.setValue('spaceId', spaceId);
  }, [spaceId, form]);

  const handleCreate = async (data: FormValues) => {
    setFormError(null);

    if (spaceId == null || web3SpaceId == null) {
      setFormError('Space information is missing. Please try again.');
      return;
    }

    const filteredData = filterChangedFormFields(data);
    const args = {
      ...filteredData,
      label: data.label,
      title: data.title,
      description: data.description,
      creatorId: data.creatorId,
      iconUrl: filteredData.iconUrl || undefined,
      spaceId,
      web3SpaceId,
      transferable: filteredData.transferable ?? filteredData.type !== 'voice',
      isVotingToken: filteredData.type === 'voice',
      referencePrice: filteredData.enableTokenPrice
        ? filteredData.tokenPrice
        : undefined,
      referenceCurrency: filteredData.enableTokenPrice
        ? filteredData.referenceCurrency
        : undefined,
      tokenAddress: filteredData.tokenAddress,
      archiveToken: data.archiveToken,
    };
    await updateIssuedToken({ ...args });
  };

  const handleInvalid = async (errors: FieldErrors<FormValues>) => {
    console.log('Invalid form fields:', errors);
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
          onSubmit={form.handleSubmit(handleCreate, handleInvalid)}
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
