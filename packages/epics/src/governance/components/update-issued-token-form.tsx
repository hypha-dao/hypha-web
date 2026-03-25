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

function collectChangedTopLevelKeys(
  dirty: Partial<Readonly<Record<string, unknown>>>,
): string[] {
  return Object.entries(dirty).reduce<string[]>((acc, [key, value]) => {
    if (value === true) {
      acc.push(key);
    } else if (value && typeof value === 'object') {
      if (Object.keys(value as object).length > 0) {
        acc.push(key);
      }
    }
    return acc;
  }, []);
}

/** Compare current icon to baseline; RHF often marks `iconUrl` dirty after hydration. */
function iconUrlEffectivelyUnchanged(
  iconUrl: unknown,
  initialIconUrl: string | undefined,
): boolean {
  if (iconUrl instanceof File) {
    return false;
  }
  const cur = typeof iconUrl === 'string' ? iconUrl : '';
  const base = initialIconUrl ?? '';
  return cur === base;
}

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
  const tAgreementFlow = useTranslations('AgreementFlow');
  const tProposalDetails = useTranslations('ProposalDetails');

  const fullSchemaUpdateIssuedToken = React.useMemo(() => {
    const extendedBaseSchema = baseSchemaIssueNewToken.merge(
      z.object({
        label: z.string().optional(),
        tokenAddress: z.string({
          message: tProposalDetails('tokenShouldBeChosen'),
        }),
        archiveToken: z.boolean().optional(),
        /** DB/chain icon URL when the token was loaded; not submitted to APIs */
        initialIconUrl: z.string().optional(),
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
            message: tProposalDetails('maxSupplyValidation'),
            path: ['maxSupply'],
          });
        }
      }

      if (data.enableTokenPrice) {
        if (!data.referenceCurrency) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: tProposalDetails('selectReferenceCurrency'),
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
            message: tProposalDetails('tokenPriceGreaterThanZero'),
            path: ['tokenPrice'],
          });
        }
      }
    });
  }, [tProposalDetails]);

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
      iconUrl: '',
      initialIconUrl: '',
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
      setFormError(tProposalDetails('spaceInformationMissing'));
      return;
    }

    const { initialIconUrl, ...submitData } = data;
    let changedTopLevelKeys = collectChangedTopLevelKeys(dirtyFields);
    if (
      !(submitData.iconUrl instanceof File) &&
      iconUrlEffectivelyUnchanged(submitData.iconUrl, initialIconUrl) &&
      changedTopLevelKeys.includes('iconUrl')
    ) {
      changedTopLevelKeys = changedTopLevelKeys.filter((k) => k !== 'iconUrl');
    }

    await updateIssuedToken({
      ...submitData,
      changedTopLevelKeys,
      label: 'Update Token',
      spaceId,
      web3SpaceId,
      transferable: submitData.transferable ?? submitData.type !== 'voice',
      isVotingToken: submitData.type === 'voice',
      referencePrice: submitData.enableTokenPrice
        ? submitData.tokenPrice
        : undefined,
      referenceCurrency: submitData.enableTokenPrice
        ? submitData.referenceCurrency
        : undefined,
    });
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
            <div>{tSpaces('errorOhSnap')}</div>
            <Button onClick={reset}>{tSpaces('reset')}</Button>
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
            backLabel={tSpaces('backToSettings')}
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
              <Button type="submit">{tAgreementFlow('buttons.publish')}</Button>
            </div>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
