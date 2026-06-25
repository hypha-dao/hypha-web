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
  WHITELIST_DUPLICATE_ENTRY_MESSAGE,
  type Space,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { useConfig } from 'wagmi';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { useRouter } from 'next/navigation';
import {
  clearResubmitProposalSessionStorage,
  useClearResubmitOnSuccess,
  useDbTokens,
  useResubmitProposalData,
  useScrollToErrors,
} from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';
import { useTranslations } from 'next-intl';

const ISSUE_TOKEN_RESUBMIT_SEGMENT = 'issue-new-token';

const ISSUE_NEW_TOKEN_ERROR_KEYS: Record<string, string> = {
  'Please add a title for your proposal':
    'issueNewTokenForm.errors.titleRequired',
  'Please add content to your proposal':
    'issueNewTokenForm.errors.descriptionRequired',
  'Slug must contain only lowercase letters, numbers, and hyphens':
    'issueNewTokenForm.errors.slugFormat',
  'Please upload a valid file': 'issueNewTokenForm.errors.uploadValidFile',
  'Your file is too large and exceeds the 16 MB limit. Please upload a smaller file.':
    'issueNewTokenForm.errors.fileTooLarge',
  'Your file is too large and exceeds the 16 MB limit. Please upload a smaller file':
    'issueNewTokenForm.errors.fileTooLarge',
  'Your file is too large and exceeds the 4MB limit. Please upload a smaller file.':
    'issueNewTokenForm.errors.fileTooLarge',
  'Your file is too large and exceeds the 4MB limit. Please upload a smaller file':
    'issueNewTokenForm.errors.fileTooLarge',
  'File must be an image (JPEG, PNG, GIF, WEBP).':
    'issueNewTokenForm.errors.imageFileType',
  'File must be an image (JPEG, PNG, GIF, WEBP)':
    'issueNewTokenForm.errors.imageFileType',
  'Lead Image URL must be a valid URL':
    'issueNewTokenForm.errors.leadImageUrlInvalid',
  'Attachment URL must be a valid URL':
    'issueNewTokenForm.errors.attachmentUrlInvalid',
  'Attachment name is required':
    'issueNewTokenForm.errors.attachmentNameRequired',
  'You can attach up to 5 files. Please remove the extra attachments.':
    'issueNewTokenForm.errors.attachmentsLimit',
  'You can attach up to 3 files. Please remove the extra attachments.':
    'issueNewTokenForm.errors.attachmentsLimit',
  'Please enter a token name (min. 2 characters)':
    'issueNewTokenForm.errors.tokenNameMin',
  'Token name must be at most 100 characters long':
    'issueNewTokenForm.errors.tokenNameMax',
  'Token name cannot contain emojis or links':
    'issueNewTokenForm.errors.tokenNameInvalidContent',
  'Please enter a token symbol (min. 2 characters)':
    'issueNewTokenForm.errors.tokenSymbolMin',
  'Token symbol must be at most 10 characters long':
    'issueNewTokenForm.errors.tokenSymbolMax',
  'Please enter the token symbol using only uppercase letters (A–Z)':
    'issueNewTokenForm.errors.tokenSymbolUppercase',
  'Token symbol cannot contain emojis or links':
    'issueNewTokenForm.errors.tokenSymbolInvalidContent',
  'Please upload a token icon': 'issueNewTokenForm.errors.tokenIconRequired',
  'Icon URL must be a valid URL':
    'issueNewTokenForm.errors.tokenIconUrlInvalid',
  'Please select a token type': 'issueNewTokenForm.errors.tokenTypeRequired',
  'Max supply must be 0 or greater':
    'issueNewTokenForm.errors.maxSupplyMinZero',
  'Max supply must be a non-negative number':
    'issueNewTokenForm.errors.maxSupplyNonNegative',
  'Please select a max supply type':
    'issueNewTokenForm.errors.maxSupplyTypeRequired',
  'Max supply must be greater than 0 when updatable type is selected':
    'issueNewTokenForm.errors.maxSupplyUpdatablePositive',
  'Enter a maximum supply greater than 0, or disable limited supply if you want unlimited supply.':
    'issueNewTokenForm.errors.maxSupplyLimitedPositiveOrDisable',
  'Please enter a voice decay frequency':
    'issueNewTokenForm.errors.voiceDecayFrequencyRequired',
  'Voice decay frequency must be greater than 0':
    'issueNewTokenForm.errors.voiceDecayFrequencyPositive',
  'Please enter a voice decay percentage':
    'issueNewTokenForm.errors.voiceDecayPercentageRequired',
  'Voice decay percentage must be greater than 0':
    'issueNewTokenForm.errors.voiceDecayPercentagePositive',
  'Decay percentage must not exceed 100%':
    'issueNewTokenForm.errors.decayPercentageMax',
  'Please enter a blockchain address':
    'issueNewTokenForm.errors.blockchainAddressRequired',
  'Please enter a valid blockchain address':
    'issueNewTokenForm.errors.blockchainAddressInvalid',
  'Please select a reference currency':
    'issueNewTokenForm.errors.referenceCurrencyRequired',
  'Please enter a token price greater than 0':
    'issueNewTokenForm.errors.tokenPricePositive',
  'Please enter a credit limit greater than 0':
    'issueNewTokenForm.errors.creditLimitPositive',
  [WHITELIST_DUPLICATE_ENTRY_MESSAGE]:
    'issueNewTokenForm.errors.duplicateWhitelistEntry',
};

const extendedBaseSchema = baseSchemaIssueNewToken.merge(
  z.object({
    label: z.string().optional(),
  }),
);

const createFullSchemaIssueNewToken = (tAgreementFlow: any) =>
  extendedBaseSchema.superRefine((data, ctx) => {
    if (data.enableLimitedSupply === true) {
      if (!data.maxSupplyType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: tAgreementFlow(
            'issueNewTokenForm.errors.maxSupplyTypeRequired',
          ),
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
          message: tAgreementFlow(
            'issueNewTokenForm.errors.maxSupplyLimitedPositiveOrDisable',
          ),
          path: ['maxSupply'],
        });
      }
    }

    if (data.enableTokenPrice) {
      if (!data.referenceCurrency) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: tAgreementFlow(
            'issueNewTokenForm.errors.referenceCurrencyRequired',
          ),
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
          message: tAgreementFlow(
            'issueNewTokenForm.errors.tokenPricePositive',
          ),
          path: ['tokenPrice'],
        });
      }
    }

    /**
     * Mutual credit only applies to RegularSpaceToken types — keep this guard
     * in sync with `useIssueNewTokenOrchestrator` and the UI gating in
     * `advanced-token-settings.tsx` so a manipulated form can't bypass it.
     */
    const isRegularToken = (
      ['utility', 'credits', 'impact', 'community_currency'] as const
    ).includes(data.type as never);
    if (data.enableMutualCredit && isRegularToken) {
      if (
        data.defaultCreditLimit === undefined ||
        data.defaultCreditLimit === null ||
        isNaN(data.defaultCreditLimit) ||
        data.defaultCreditLimit <= 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: tAgreementFlow(
            'issueNewTokenForm.errors.creditLimitPositive',
          ),
          path: ['defaultCreditLimit'],
        });
      }
    }
  });

type FormValues = z.infer<typeof extendedBaseSchema>;

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
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
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
  const fullSchemaIssueNewToken = React.useMemo(
    () => createFullSchemaIssueNewToken(tAgreementFlow),
    [tAgreementFlow],
  );

  const translateIssueNewTokenError = React.useCallback(
    (message: string) => {
      const tooLargeMatch = message.match(
        /^Your file "(.+)" is too large and exceeds the \d+ ?MB limit\. Please upload a smaller file\.?$/,
      );
      if (tooLargeMatch?.[1]) {
        return tAgreementFlow(
          'issueNewTokenForm.errors.attachmentFileTooLarge',
          {
            fileName: tooLargeMatch[1],
          },
        );
      }

      const unsupportedFormatMatch = message.match(
        /^This file "(.+)" format isn[’']t supported\. Please upload a JPEG, PNG, WebP, or PDF \(up to \d+ ?MB\)\.?$/,
      );
      if (unsupportedFormatMatch?.[1]) {
        return tAgreementFlow(
          'issueNewTokenForm.errors.attachmentFileTypeUnsupported',
          {
            fileName: unsupportedFormatMatch[1],
          },
        );
      }

      const key = ISSUE_NEW_TOKEN_ERROR_KEYS[message];
      return key
        ? tAgreementFlow(key as Parameters<typeof tAgreementFlow>[0])
        : message;
    },
    [tAgreementFlow],
  );

  const localizeErrors = React.useCallback(
    (errors: unknown): unknown => {
      if (!errors || typeof errors !== 'object') return errors;
      if (Array.isArray(errors)) {
        const localizedArray = errors.map(localizeErrors);
        const localizedArrayWithMeta = localizedArray as unknown as Record<
          string,
          unknown
        >;

        for (const [key, value] of Object.entries(errors)) {
          if (!/^\d+$/.test(key)) {
            localizedArrayWithMeta[key] =
              value && typeof value === 'object'
                ? localizeErrors(value)
                : value;
          }
        }

        return localizedArray;
      }

      const localized = { ...(errors as Record<string, unknown>) };

      if (typeof localized.message === 'string') {
        localized.message = translateIssueNewTokenError(localized.message);
      }

      if (localized.types && typeof localized.types === 'object') {
        const localizedTypes: Record<string, unknown> = { ...localized.types };
        for (const [typeKey, typeValue] of Object.entries(localizedTypes)) {
          if (typeof typeValue === 'string') {
            localizedTypes[typeKey] = translateIssueNewTokenError(typeValue);
          }
        }
        localized.types = localizedTypes;
      }

      for (const [key, value] of Object.entries(localized)) {
        if (
          key === 'message' ||
          key === 'type' ||
          key === 'ref' ||
          key === 'types'
        ) {
          continue;
        }
        if (value && typeof value === 'object') {
          localized[key] = localizeErrors(value);
        }
      }

      return localized;
    },
    [translateIssueNewTokenError],
  );

  const resolver = React.useMemo(() => {
    const baseResolver = zodResolver(fullSchemaIssueNewToken);

    return async (...args: Parameters<typeof baseResolver>) => {
      const result = await baseResolver(...args);
      return {
        ...result,
        errors: localizeErrors(result.errors) as typeof result.errors,
      };
    };
  }, [fullSchemaIssueNewToken, localizeErrors]);

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver,
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
      isVotingToken: false,
      transferable: true,
      enableAdvancedTransferControls: false,
      /** Listed so `form.reset()` clears whitelist rows (incl. blockchain addresses). */
      transferWhitelist: undefined,
      enableProposalAutoMinting: true,
      enableLimitedSupply: false,
      maxSupplyType: undefined,
      enableTokenPrice: false,
      referenceCurrency: undefined,
      tokenPrice: undefined,
      enableMutualCredit: false,
      defaultCreditLimit: undefined,
      creditWhitelistedSpaceIds: [],
      authorizedMinters: [],
      spacesForWhitelistResolution: undefined,
      label: tAgreementFlow('labels.issueNewToken'),
    },
    mode: 'onChange',
  });

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(
    form,
    spaceId,
    person?.id,
    ISSUE_TOKEN_RESUBMIT_SEGMENT,
  );

  useClearResubmitOnSuccess(progress === 100 && !isError);

  const { tokens: dbTokens, refetchDbTokens } = useDbTokens();

  const tokenType = form.watch('type');

  React.useEffect(() => {
    refetchDbTokens();
  }, [refetchDbTokens]);

  React.useEffect(() => {
    if (progress === 100 && agreementSlug) {
      clearResubmitProposalSessionStorage();
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
      setFormError(tAgreementFlow('issueNewTokenForm.duplicateToken'));
      return;
    }

    if (
      data.enableMutualCredit &&
      !(
        typeof web3SpaceId === 'number' &&
        Number.isInteger(web3SpaceId) &&
        web3SpaceId > 0
      )
    ) {
      setFormError(
        tAgreementFlow('issueNewTokenForm.errors.creditLimitPositive'),
      );
      return;
    }
    await createIssueToken({
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
      enableMutualCredit: data.enableMutualCredit,
      defaultCreditLimit: data.enableMutualCredit
        ? data.defaultCreditLimit
        : undefined,
      creditWhitelistedSpaceIds: data.enableMutualCredit
        ? data.creditWhitelistedSpaceIds
        : undefined,
      spacesForWhitelistResolution: data.spacesForWhitelistResolution as
        | Space[]
        | undefined,
    });
  };

  return (
    <SpaceLoadingBackdrop
      showKeepWindowOpenMessage={true}
      keepWindowOpenMessage={tAgreementFlow('loadingBackdrop.keepWindowOpen')}
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
            backLabel={tSpaces('backToSettings')}
            isLoading={false}
            label={tAgreementFlow('labels.issueNewToken')}
            progress={progress}
          />
          {React.isValidElement(plugin)
            ? React.cloneElement(
                plugin as React.ReactElement<{ resubmitKey?: number }>,
                { resubmitKey },
              )
            : plugin}
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
    </SpaceLoadingBackdrop>
  );
};
