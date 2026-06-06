'use client';

import {
  FieldErrors,
  FormProvider,
  useForm,
  type DefaultValues,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  baseSchemaIssueNewToken,
  useMe,
  useUpdateIssuedTokenOrchestrator,
  useJwt,
  WHITELIST_DUPLICATE_ENTRY_MESSAGE,
  type Space,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { useConfig } from 'wagmi';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
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

/** Keys that drive on-chain whitelist encoding — strip if user did not edit whitelist UI */
const WHITELIST_WEB3_RELATED_KEYS = new Set([
  'enableAdvancedTransferControls',
  'transferWhitelist',
  'spacesForWhitelistResolution',
  'whitelistBaselineFrom',
  'whitelistBaselineTo',
  'whitelistBaselineFromMembers',
  'whitelistBaselineToMembers',
  'whitelistBaselineFromSpaceIds',
  'whitelistBaselineToSpaceIds',
]);

function shouldIncludeWhitelistInWeb3Payload(
  dirty: Partial<Readonly<Record<string, unknown>>>,
): boolean {
  if (dirty.enableAdvancedTransferControls === true) {
    return true;
  }
  const tw = dirty.transferWhitelist;
  if (tw === true) {
    return true;
  }
  if (tw && typeof tw === 'object' && Object.keys(tw as object).length > 0) {
    return true;
  }
  return false;
}

/**
 * Avoid encoding whitelist / decay calldata when only unrelated fields were dirtied
 * (e.g. hydration or field-array sync marking transferWhitelist dirty).
 */
export function filterUpdateTokenChangedKeysForWeb3(
  changedKeys: string[],
  dirty: Partial<Readonly<Record<string, unknown>>>,
  tokenType: string | undefined,
): string[] {
  let keys = [...changedKeys];

  if (!shouldIncludeWhitelistInWeb3Payload(dirty)) {
    keys = keys.filter((k) => !WHITELIST_WEB3_RELATED_KEYS.has(k));
  }

  if (tokenType !== 'voice') {
    keys = keys.filter((k) => k !== 'decaySettings');
  }

  return keys;
}

/** Voice-token decay: which nested fields RHF marked dirty (for partial setDecay* calldata). */
export function getDecaySubfieldDirtyFlags(
  dirty: Partial<Readonly<Record<string, unknown>>>,
): {
  decayIntervalDirty?: boolean;
  decayPercentageDirty?: boolean;
} {
  const ds = dirty.decaySettings;
  if (!ds || typeof ds !== 'object') {
    return {};
  }
  const o = ds as Record<string, unknown>;
  const out: {
    decayIntervalDirty?: boolean;
    decayPercentageDirty?: boolean;
  } = {};
  if (o.decayInterval === true) {
    out.decayIntervalDirty = true;
  }
  if (o.decayPercentage === true) {
    out.decayPercentageDirty = true;
  }
  return out;
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

type TProposalDetails = (key: string) => string;
type TAgreementFlow = (key: string) => string;

/** Exported for `useFormContext` typing in update-token plugin (same schema as the form). */
export function buildFullSchemaUpdateIssuedToken(
  tProposalDetails: TProposalDetails,
  tAgreementFlow: TAgreementFlow,
) {
  const extendedBaseSchema = baseSchemaIssueNewToken.merge(
    z.object({
      label: z.string().optional(),
      tokenAddress: z.string({
        message: tProposalDetails('tokenShouldBeChosen'),
      }),
      archiveToken: z.boolean().optional(),
      /** DB/chain icon URL when the token was loaded; not submitted to APIs */
      initialIconUrl: z.string().optional(),
      /** Snapshot when the form loaded; used for on-chain whitelist diffs (not user-facing) */
      whitelistBaselineFrom: z.array(z.string()).optional(),
      whitelistBaselineTo: z.array(z.string()).optional(),
      whitelistBaselineFromMembers: z.array(z.string()).optional(),
      whitelistBaselineToMembers: z.array(z.string()).optional(),
      whitelistBaselineFromSpaceIds: z.array(z.number()).optional(),
      whitelistBaselineToSpaceIds: z.array(z.number()).optional(),
      /** Passed from plugin for resolving space rows → web3 ids in orchestrator */
      spacesForWhitelistResolution: z
        .array(
          z.object({
            address: z.string().nullable().optional(),
            web3SpaceId: z.number().int().nullable().optional(),
          }),
        )
        .optional(),
      /** On-chain mutual credit baseline at form load — used for add/remove diffing */
      creditBaselineDefaultLimit: z.number().optional(),
      creditBaselineWhitelistedSpaceIds: z.array(z.number()).optional(),
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
      if (!data.maxSupplyType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: tAgreementFlow(
            'issueNewTokenForm.errors.maxSupplyTypeRequired',
          ),
          path: ['maxSupplyType'],
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

    if (data.enableMutualCredit) {
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
}

export type UpdateIssuedTokenFormValues = z.infer<
  ReturnType<typeof buildFullSchemaUpdateIssuedToken>
>;

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

  const fullSchemaUpdateIssuedToken = React.useMemo(
    () => buildFullSchemaUpdateIssuedToken(tProposalDetails, tAgreementFlow),
    [tProposalDetails, tAgreementFlow],
  );

  const translateUpdateTokenError = React.useCallback(
    (message: string) => {
      if (message === WHITELIST_DUPLICATE_ENTRY_MESSAGE) {
        return tAgreementFlow(
          'issueNewTokenForm.errors.duplicateWhitelistEntry',
        );
      }
      return message;
    },
    [tAgreementFlow],
  );

  const localizeUpdateTokenErrors = React.useCallback(
    (errors: unknown): unknown => {
      if (!errors || typeof errors !== 'object') return errors;
      if (Array.isArray(errors)) {
        const localizedArray = errors.map((e) => localizeUpdateTokenErrors(e));
        const localizedArrayWithMeta = localizedArray as unknown as Record<
          string,
          unknown
        >;

        for (const [key, value] of Object.entries(errors)) {
          if (!/^\d+$/.test(key)) {
            localizedArrayWithMeta[key] =
              value && typeof value === 'object'
                ? localizeUpdateTokenErrors(value)
                : value;
          }
        }

        return localizedArray;
      }

      const localized = { ...(errors as Record<string, unknown>) };

      if (typeof localized.message === 'string') {
        localized.message = translateUpdateTokenError(localized.message);
      }

      if (localized.types && typeof localized.types === 'object') {
        const localizedTypes: Record<string, unknown> = { ...localized.types };
        for (const [typeKey, typeValue] of Object.entries(localizedTypes)) {
          if (typeof typeValue === 'string') {
            localizedTypes[typeKey] = translateUpdateTokenError(typeValue);
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
          localized[key] = localizeUpdateTokenErrors(value);
        }
      }

      return localized;
    },
    [translateUpdateTokenError],
  );

  const resolver = React.useMemo(() => {
    const baseResolver = zodResolver(fullSchemaUpdateIssuedToken);

    return async (...args: Parameters<typeof baseResolver>) => {
      const result = await baseResolver(...args);
      return {
        ...result,
        errors: localizeUpdateTokenErrors(
          result.errors,
        ) as typeof result.errors,
      };
    };
  }, [fullSchemaUpdateIssuedToken, localizeUpdateTokenErrors]);

  type FormValues = UpdateIssuedTokenFormValues;

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
  const formDefaultValues = React.useMemo(
    (): DefaultValues<FormValues> => ({
      label: tProposalDetails('updateTokenLabel'),
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
      maxSupplyType: undefined,
      enableTokenPrice: false,
      referenceCurrency: undefined,
      tokenPrice: undefined,
      tokenAddress: undefined,
      archiveToken: false,
      enableMutualCredit: false,
      defaultCreditLimit: undefined,
      creditWhitelistedSpaceIds: [],
      creditBaselineDefaultLimit: undefined,
      creditBaselineWhitelistedSpaceIds: undefined,
      authorizedMinters: [],
      authorizedMintersToRevoke: [],
      whitelistBaselineFrom: undefined,
      whitelistBaselineTo: undefined,
      whitelistBaselineFromMembers: undefined,
      whitelistBaselineToMembers: undefined,
      whitelistBaselineFromSpaceIds: undefined,
      whitelistBaselineToSpaceIds: undefined,
      spacesForWhitelistResolution: undefined,
    }),
    [tProposalDetails, spaceId, person?.id],
  );

  const form = useForm<FormValues>({
    resolver,
    defaultValues: formDefaultValues,
    mode: 'onChange',
  });
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
  }, [person, form]);

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
    /** Read at submit time — avoids stale closure from render-only `dirtyFields` */
    const dirtyAtSubmit = form.formState.dirtyFields;
    let changedTopLevelKeys = collectChangedTopLevelKeys(dirtyAtSubmit);
    if (
      !(submitData.iconUrl instanceof File) &&
      iconUrlEffectivelyUnchanged(submitData.iconUrl, initialIconUrl) &&
      changedTopLevelKeys.includes('iconUrl')
    ) {
      changedTopLevelKeys = changedTopLevelKeys.filter((k) => k !== 'iconUrl');
    }
    changedTopLevelKeys = filterUpdateTokenChangedKeysForWeb3(
      changedTopLevelKeys,
      dirtyAtSubmit,
      submitData.type,
    );

    const decayFlags = getDecaySubfieldDirtyFlags(dirtyAtSubmit);

    await updateIssuedToken({
      ...submitData,
      ...decayFlags,
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
      whitelistBaselineFrom: submitData.whitelistBaselineFrom as
        | `0x${string}`[]
        | undefined,
      whitelistBaselineTo: submitData.whitelistBaselineTo as
        | `0x${string}`[]
        | undefined,
      whitelistBaselineFromMembers: submitData.whitelistBaselineFromMembers as
        | `0x${string}`[]
        | undefined,
      whitelistBaselineToMembers: submitData.whitelistBaselineToMembers as
        | `0x${string}`[]
        | undefined,
      whitelistBaselineFromSpaceIds: submitData.whitelistBaselineFromSpaceIds,
      whitelistBaselineToSpaceIds: submitData.whitelistBaselineToSpaceIds,
      spacesForWhitelistResolution: submitData.spacesForWhitelistResolution as
        | Space[]
        | undefined,
      enableMutualCredit: submitData.enableMutualCredit,
      defaultCreditLimit: submitData.defaultCreditLimit,
      creditWhitelistedSpaceIds: submitData.creditWhitelistedSpaceIds,
      creditBaselineDefaultLimit: submitData.creditBaselineDefaultLimit,
      creditBaselineWhitelistedSpaceIds:
        submitData.creditBaselineWhitelistedSpaceIds,
    });
  };

  const handleInvalid = async (_errors: FieldErrors<FormValues>) => {
    // Validation errors are shown inline on fields
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
            label={tProposalDetails('updateTokenLabel')}
            progress={progress}
          />
          <FormProvider {...form}>{plugin}</FormProvider>
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
