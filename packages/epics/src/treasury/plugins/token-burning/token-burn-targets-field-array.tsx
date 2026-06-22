'use client';

import {
  Button,
  Checkbox,
  Combobox,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormLabel,
  Input,
  RequirementMark,
  Image,
  Skeleton,
} from '@hypha-platform/ui';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui/server';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { useEffect, useMemo } from 'react';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  Person,
  publicClient,
  Space,
} from '@hypha-platform/core/client';
import { useFilterSpacesListWithDiscoverability } from '../../../spaces';
import { useTranslations } from 'next-intl';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import useSWR from 'swr';
import { erc20Abi, formatUnits, isAddress, parseUnits } from 'viem';
import { resolveTokenDecimals } from '../../../governance/utils/token-decimals';

type TokenBurnTargetsFieldArrayProps = {
  members?: Person[];
  spaces?: Space[];
  selectedTokenAddress?: `0x${string}`;
  selectedTokenSymbol?: string;
  name?: string;
};

type BurnTargetEntry = {
  type?: 'member' | 'space';
  address?: string;
  amount?: string;
  allBalance?: boolean;
};

const DEFAULT_TARGET = {
  type: 'member' as const,
  address: '',
  amount: '',
  allBalance: false,
};

export const TokenBurnTargetsFieldArray = ({
  members = [],
  spaces = [],
  selectedTokenAddress,
  selectedTokenSymbol,
  name = 'tokenBurning.burns',
}: TokenBurnTargetsFieldArrayProps) => {
  const { control, setValue, clearErrors } = useFormContext();
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { filteredSpaces } = useFilterSpacesListWithDiscoverability({
    spaces,
    useGeneralState: true,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });
  const entries = (useWatch({ control, name }) ?? []) as BurnTargetEntry[];

  const memberOptions = useMemo(
    () =>
      members
        .filter((member) => member.address)
        .map((member) => ({
          value: member.address as string,
          label: `${member.name} ${member.surname}`,
          searchText: `${member.name} ${member.surname}`.toLowerCase(),
          avatarUrl: member.avatarUrl,
          address: member.address as string,
        })),
    [members],
  );

  const spaceOptions = useMemo(
    () =>
      filteredSpaces
        .filter((space) => space.address)
        .map((space) => ({
          value: space.address as string,
          label: space.title,
          searchText: space.title.toLowerCase(),
          avatarUrl: space.logoUrl,
          address: space.address as string,
        })),
    [filteredSpaces],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1">
        <FormLabel>
          {tAgreementFlow('plugins.tokenBurning.burnTargetsLabel')}
        </FormLabel>
        <RequirementMark className="text-2" />
      </div>

      {fields.map((field, index) => {
        const entry = entries[index] ?? DEFAULT_TARGET;
        const currentType = entry.type === 'space' ? 'space' : 'member';
        const currentOptions =
          currentType === 'member' ? memberOptions : spaceOptions;
        return (
          <div
            key={field.id}
            className="flex flex-col gap-4 rounded-xl border border-neutral-6 p-4"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <span className="text-2 text-neutral-11">
                {tAgreementFlow('plugins.tokenBurning.recipientTypeLabel')}
              </span>
              <div className="flex w-full flex-col gap-2 md:max-w-3xl">
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <FormField
                    control={control}
                    name={`${name}.${index}.type`}
                    render={({ field: typeField }) => (
                      <Tabs
                        value={typeField.value ?? 'member'}
                        onValueChange={(value) => {
                          typeField.onChange(value);
                          setValue(`${name}.${index}.address`, '', {
                            shouldDirty: true,
                            shouldTouch: true,
                            shouldValidate: true,
                          });
                        }}
                      >
                        <TabsList triggerVariant="switch">
                          <TabsTrigger variant="switch" value="member">
                            {tAgreementFlow('plugins.tokenBurning.member')}
                          </TabsTrigger>
                          <TabsTrigger variant="switch" value="space">
                            {tAgreementFlow('plugins.tokenBurning.space')}
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    )}
                  />
                  <div className="w-full md:min-w-72">
                    <Combobox
                      options={currentOptions}
                      placeholder={
                        currentType === 'member'
                          ? tAgreementFlow(
                              'plugins.tokenBurning.selectMemberPlaceholder',
                            )
                          : tAgreementFlow(
                              'plugins.tokenBurning.selectSpacePlaceholder',
                            )
                      }
                      initialValue={entry.address}
                      onChange={(value) =>
                        setValue(`${name}.${index}.address`, value, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        })
                      }
                      emptyListMessage={
                        currentType === 'member'
                          ? tAgreementFlow(
                              'plugins.tokenBurning.noMembersFound',
                            )
                          : tAgreementFlow('plugins.tokenBurning.noSpacesFound')
                      }
                      renderOption={(option) => (
                        <>
                          <Image
                            src={
                              option.avatarUrl ||
                              (currentType === 'member'
                                ? '/placeholder/default-profile.svg'
                                : DEFAULT_SPACE_AVATAR_IMAGE)
                            }
                            alt={option.label}
                            width={24}
                            height={24}
                            className="rounded-full min-h-5 min-w-5"
                          />
                          <span className="text-ellipsis overflow-hidden text-nowrap">
                            {option.label}
                          </span>
                        </>
                      )}
                      renderValue={(option) =>
                        option ? (
                          <div className="flex items-center gap-2 truncate">
                            <Image
                              src={
                                option.avatarUrl ||
                                (currentType === 'member'
                                  ? '/placeholder/default-profile.svg'
                                  : DEFAULT_SPACE_AVATAR_IMAGE)
                              }
                              alt={option.label}
                              width={24}
                              height={24}
                              className="rounded-full min-h-5 min-w-5"
                            />
                            <span className="truncate text-ellipsis overflow-hidden text-nowrap">
                              {option.label}
                            </span>
                          </div>
                        ) : currentType === 'member' ? (
                          tAgreementFlow(
                            'plugins.tokenBurning.selectMemberPlaceholder',
                          )
                        ) : (
                          tAgreementFlow(
                            'plugins.tokenBurning.selectSpacePlaceholder',
                          )
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <FormField
              control={control}
              name={`${name}.${index}.address`}
              render={({ field: addressField }) => (
                <FormItem className="flex flex-col gap-2">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <label className="text-2 text-neutral-11 flex flex-row gap-1 whitespace-nowrap">
                      {tAgreementFlow('plugins.tokenBurning.walletAddress')}
                      <RequirementMark className="text-2" />
                    </label>
                    <div className="w-full md:w-72">
                      <Input
                        placeholder={tAgreementFlow(
                          'plugins.tokenBurning.walletAddressPlaceholder',
                        )}
                        value={addressField.value ?? ''}
                        onChange={addressField.onChange}
                      />
                    </div>
                  </div>
                  {selectedTokenAddress &&
                  (addressField.value ?? '').length > 0 ? (
                    <RecipientTokenBalanceHint
                      tokenAddress={selectedTokenAddress}
                      recipientAddress={addressField.value}
                      tokenSymbol={selectedTokenSymbol}
                    />
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-start">
              <FormField
                control={control}
                name={`${name}.${index}.amount`}
                render={({ field: amountField }) => (
                  <FormItem className="flex flex-col gap-2">
                    <label className="text-2 text-neutral-11 flex flex-row gap-1">
                      {tAgreementFlow('plugins.tokenBurning.amountLabel')}
                      <RequirementMark className="text-2" />
                    </label>
                    <FormControl>
                      <Input
                        placeholder={tAgreementFlow(
                          'plugins.tokenBurning.amountPlaceholder',
                        )}
                        value={amountField.value ?? ''}
                        onChange={amountField.onChange}
                        disabled={Boolean(entry.allBalance)}
                      />
                    </FormControl>
                    <FormMessage />
                    {selectedTokenAddress ? (
                      <BurnAmountBalanceValidationMessage
                        tokenAddress={selectedTokenAddress}
                        recipientAddress={entry.address}
                        amountFieldName={`${name}.${index}.amount`}
                        amountValue={entry.amount}
                        allBalance={entry.allBalance}
                      />
                    ) : null}
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name={`${name}.${index}.allBalance`}
                render={({ field: allBalanceField }) => (
                  <FormItem className="flex flex-col gap-2">
                    <span
                      className="invisible text-2 select-none flex flex-row gap-1"
                      aria-hidden
                    >
                      {tAgreementFlow('plugins.tokenBurning.amountLabel')}
                      <RequirementMark className="text-2" />
                    </span>
                    <div className="flex items-center gap-2 h-10">
                      <Checkbox
                        checked={Boolean(allBalanceField.value)}
                        onCheckedChange={(checked) => {
                          const isChecked = checked === true;
                          allBalanceField.onChange(isChecked);
                          if (isChecked) {
                            // Amount will be auto-populated from recipient balance.
                            setValue(`${name}.${index}.amount`, '');
                            clearErrors(`${name}.${index}.amount`);
                          }
                        }}
                      />
                      <span className="text-2 text-neutral-11">
                        {tAgreementFlow('plugins.tokenBurning.allBalance')}
                      </span>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            {entry.allBalance ? (
              <div className="text-2 text-neutral-11">
                {tAgreementFlow('plugins.tokenBurning.allBalanceWarning')}
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button
                variant="ghost"
                onClick={(event) => {
                  event.preventDefault();
                  remove(index);
                }}
                className="gap-2 text-2"
                disabled={fields.length <= 1}
              >
                <Cross2Icon />
                {tAgreementFlow('plugins.tokenBurning.remove')}
              </Button>
            </div>
          </div>
        );
      })}

      <div className="flex justify-start md:justify-end">
        <Button
          variant="ghost"
          onClick={(event) => {
            event.preventDefault();
            append({ ...DEFAULT_TARGET });
          }}
          className="gap-2 text-2"
        >
          <PlusIcon />
          {tAgreementFlow('plugins.tokenBurning.add')}
        </Button>
      </div>
    </div>
  );
};

function useRecipientTokenBalance({
  tokenAddress,
  recipientAddress,
}: {
  tokenAddress: `0x${string}`;
  recipientAddress?: string;
}) {
  const isValidRecipient = Boolean(
    recipientAddress && isAddress(recipientAddress),
  );

  const { data, error, isLoading } = useSWR(
    isValidRecipient
      ? [tokenAddress, recipientAddress, 'recipient-balance']
      : null,
    async ([address, recipient]) =>
      publicClient.readContract({
        address: address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [recipient as `0x${string}`],
      }),
    { revalidateOnFocus: true },
  );

  return { data, error, isLoading, isValidRecipient };
}

function RecipientTokenBalanceHint({
  tokenAddress,
  recipientAddress,
  tokenSymbol,
}: {
  tokenAddress: `0x${string}`;
  recipientAddress?: string;
  tokenSymbol?: string;
}) {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { data, error, isLoading, isValidRecipient } = useRecipientTokenBalance(
    {
      tokenAddress,
      recipientAddress,
    },
  );

  if (!isValidRecipient) {
    return null;
  }

  if (isLoading) {
    return (
      <span className="text-1 text-neutral-10">
        {tAgreementFlow('plugins.tokenBurning.recipientBalanceLoading')}
      </span>
    );
  }

  if (error || data == null) {
    return (
      <span className="text-1 text-neutral-10">
        {tAgreementFlow('plugins.tokenBurning.recipientBalanceUnavailable')}
      </span>
    );
  }

  const decimals = resolveTokenDecimals(tokenAddress);
  const normalizedBalance = Number(formatUnits(data, decimals));

  return (
    <Skeleton loading={false} width={220} height={20}>
      <span className="text-1 text-neutral-10">
        {tAgreementFlow('plugins.tokenBurning.recipientBalance')}:{' '}
        {tAgreementFlow('plugins.tokenBurning.recipientBalanceValue', {
          value: formatCurrencyValue(normalizedBalance),
          symbol: tokenSymbol ?? '',
        })}
      </span>
    </Skeleton>
  );
}

function BurnAmountBalanceValidationMessage({
  tokenAddress,
  recipientAddress,
  amountFieldName,
  amountValue,
  allBalance,
}: {
  tokenAddress: `0x${string}`;
  recipientAddress?: string;
  amountFieldName: string;
  amountValue?: string;
  allBalance?: boolean;
}) {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { setError, clearErrors, getFieldState, formState, setValue } =
    useFormContext();
  const { data, error, isLoading, isValidRecipient } = useRecipientTokenBalance(
    {
      tokenAddress,
      recipientAddress,
    },
  );
  const exceedsBalanceMessage = tAgreementFlow(
    'plugins.tokenBurning.burnAmountExceedsBalance',
  );
  const amountGreaterThanZeroMessage = tAgreementFlow(
    'proposalErrors.amountGreaterThanZero',
  );
  const decimals = resolveTokenDecimals(tokenAddress);
  const normalizedAmountInput = (amountValue ?? '').trim().replace(',', '.');
  const normalizedAmount = normalizedAmountInput.startsWith('.')
    ? `0${normalizedAmountInput}`
    : normalizedAmountInput.endsWith('.')
    ? `${normalizedAmountInput}0`
    : normalizedAmountInput;

  let nextManagedErrorMessage: string | null | undefined;
  if (!isValidRecipient) {
    nextManagedErrorMessage = null;
  } else if (isLoading || error || data == null) {
    // Keep current managed manual error while balance state is unresolved.
    nextManagedErrorMessage = undefined;
  } else if (allBalance) {
    nextManagedErrorMessage = data === 0n ? amountGreaterThanZeroMessage : null;
  } else if (normalizedAmount.length === 0) {
    nextManagedErrorMessage = null;
  } else {
    try {
      nextManagedErrorMessage =
        parseUnits(normalizedAmount, decimals) > data
          ? exceedsBalanceMessage
          : null;
    } catch {
      nextManagedErrorMessage = null;
    }
  }

  const currentError = getFieldState(amountFieldName, formState).error;
  const hasManagedManualError =
    currentError?.type === 'manual' &&
    (currentError.message === exceedsBalanceMessage ||
      currentError.message === amountGreaterThanZeroMessage);

  useEffect(() => {
    if (nextManagedErrorMessage === undefined) {
      return;
    }

    if (nextManagedErrorMessage === null) {
      if (hasManagedManualError) {
        clearErrors(amountFieldName);
      }
      return;
    }

    const shouldSetManualError =
      !hasManagedManualError ||
      currentError?.message !== nextManagedErrorMessage;
    if (shouldSetManualError) {
      setError(amountFieldName, {
        type: 'manual',
        message: nextManagedErrorMessage,
      });
    }
  }, [
    amountFieldName,
    clearErrors,
    nextManagedErrorMessage,
    hasManagedManualError,
    setError,
    currentError?.message,
  ]);

  useEffect(() => {
    if (!allBalance) {
      return;
    }
    if (!isValidRecipient || isLoading || error || data == null) {
      return;
    }

    const autoAmountRaw = formatUnits(data, decimals);
    const autoAmount = autoAmountRaw.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
    if (autoAmount.length === 0) {
      return;
    }

    setValue(amountFieldName, autoAmount, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [
    allBalance,
    amountFieldName,
    data,
    decimals,
    error,
    isLoading,
    isValidRecipient,
    setValue,
  ]);

  return null;
}
