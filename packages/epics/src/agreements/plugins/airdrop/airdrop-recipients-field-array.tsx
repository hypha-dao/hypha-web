'use client';

import React from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  FormLabel,
  Image,
  Input,
  RequirementMark,
  Separator,
} from '@hypha-platform/ui';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui/server';
import { ChevronDownIcon } from '@radix-ui/themes';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { Person, Space } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';

import { RecipientField } from '../components/common/recipient-field';
import { Token } from '../components/common/token-payout-field-array';
import { AirdropRecipient, MAX_AIRDROP_RECIPIENTS } from './airdrop.validation';

const DEFAULT_RECIPIENT: AirdropRecipient = { recipient: '', amount: '' };

interface AirdropRecipientsFieldArrayProps {
  tokens: Token[];
  members: Person[];
  spaces?: Space[];
  spaceSlug: string;
  name?: string;
}

function TokenSelect({
  tokens,
  value,
  onChange,
}: {
  tokens: Token[];
  value?: string;
  onChange: (address: string) => void;
}) {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const selectedToken = value
    ? tokens.find((t) => t.address.toLowerCase() === value.toLowerCase())
    : undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          colorVariant="neutral"
          role="combobox"
          className="h-10 min-h-10 w-full justify-between px-3 py-0 text-sm font-normal"
        >
          <div className="flex items-center gap-2">
            {selectedToken ? (
              <>
                <Image
                  src={selectedToken.icon}
                  width={20}
                  height={20}
                  alt={selectedToken.symbol}
                  className="mr-2 rounded-full h-4 w-4"
                />
                <span className="text-2 text-neutral-11">
                  {selectedToken.symbol}
                </span>
              </>
            ) : (
              <span className="text-2 text-neutral-11 whitespace-nowrap">
                {tAgreementFlow('plugins.tokenPayoutField.selectToken')}
              </span>
            )}
          </div>
          <ChevronDownIcon className="size-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-full max-h-[200px] overflow-y-scroll">
        {tokens.length > 0 ? (
          tokens.map((token) => (
            <DropdownMenuItem
              key={token.address}
              onSelect={() => onChange(token.address)}
            >
              <Image
                src={token.icon}
                width={24}
                height={24}
                alt={token.symbol}
                className="mr-2 rounded-full h-5 w-5"
              />
              <div className="flex flex-col">
                <span className="text-2 text-neutral-11">{token.symbol}</span>
                {token?.space?.title ? (
                  <span className="text-1 text-accent-11">
                    {tAgreementFlow('plugins.tokenPayoutField.bySpace', {
                      space: token.space.title,
                    })}
                  </span>
                ) : null}
              </div>
            </DropdownMenuItem>
          ))
        ) : (
          <span className="text-2 text-neutral-11">
            {tAgreementFlow('plugins.tokenPayoutField.noTokensFound')}
          </span>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const AirdropRecipientsFieldArray = ({
  tokens,
  members,
  spaces,
  spaceSlug,
  name = 'airdrop',
}: AirdropRecipientsFieldArrayProps) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { control, setValue, getValues } = useFormContext();

  const method = (useWatch({ control, name: `${name}.method` }) ??
    'transfer') as 'transfer' | 'mint';

  /** Space-created tokens can be minted; everything in the treasury can be transferred. */
  const mintableTokens = React.useMemo(
    () => tokens.filter((token) => token.space?.slug === spaceSlug),
    [tokens, spaceSlug],
  );
  const availableTokens = method === 'mint' ? mintableTokens : tokens;

  const { fields, append, remove } = useFieldArray({
    control,
    name: `${name}.recipients`,
  });
  const canAddMore = fields.length < MAX_AIRDROP_RECIPIENTS;

  return (
    <div className="flex flex-col gap-4">
      {/* Method + token are chosen once and apply to every recipient. */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <span className="text-2 text-neutral-11">
          {tAgreementFlow('plugins.airdrop.methodLabel')}
        </span>
        <FormField
          control={control}
          name={`${name}.method`}
          render={({ field: methodField }) => (
            <Tabs
              value={methodField.value ?? 'transfer'}
              onValueChange={(value) => {
                methodField.onChange(value);
                // Selected token may no longer be valid for the new method.
                setValue(`${name}.token`, '', {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
            >
              <TabsList triggerVariant="switch">
                <TabsTrigger variant="switch" value="transfer">
                  {tAgreementFlow('plugins.airdrop.transfer')}
                </TabsTrigger>
                <TabsTrigger variant="switch" value="mint">
                  {tAgreementFlow('plugins.airdrop.mint')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        />
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <span className="flex items-center gap-1 text-2 text-neutral-11">
          {tAgreementFlow('plugins.airdrop.tokenLabel')}
          <RequirementMark className="text-2" />
        </span>
        <div className="w-full md:max-w-72">
          <FormField
            control={control}
            name={`${name}.token`}
            render={({ field: tokenField }) => (
              <FormItem>
                <FormControl>
                  <TokenSelect
                    tokens={availableTokens}
                    value={tokenField.value}
                    onChange={(address) =>
                      setValue(`${name}.token`, address, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      {method === 'mint' && mintableTokens.length === 0 ? (
        <span className="text-1 text-neutral-10">
          {tAgreementFlow('plugins.airdrop.noMintableTokens')}
        </span>
      ) : null}

      <Separator />

      <div className="flex items-center gap-1">
        <FormLabel>
          {tAgreementFlow('plugins.airdrop.recipientsLabel')}
        </FormLabel>
        <RequirementMark className="text-2" />
      </div>

      {fields.map((field, index) => (
        <div
          key={field.id}
          className="flex flex-col gap-4 rounded-xl border border-neutral-6 p-4"
        >
          <RecipientField
            name={`${name}.recipients.${index}.recipient`}
            members={members}
            spaces={spaces}
            defaultRecipientType="member"
          />

          <FormField
            control={control}
            name={`${name}.recipients.${index}.amount`}
            render={({ field: amountField }) => (
              <FormItem className="flex flex-col gap-2">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <label className="flex flex-row gap-1 text-2 text-neutral-11">
                    {tAgreementFlow('plugins.airdrop.amountLabel')}
                    <RequirementMark className="text-2" />
                  </label>
                  <div className="w-full md:w-72">
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder={tAgreementFlow(
                          'plugins.tokenPayoutField.amount',
                        )}
                        value={amountField.value ?? ''}
                        onChange={(event) => {
                          const normalized = event.target.value.replace(
                            ',',
                            '.',
                          );
                          if (
                            normalized === '' ||
                            /^\d*\.?\d*$/.test(normalized)
                          ) {
                            amountField.onChange(normalized);
                          }
                        }}
                      />
                    </FormControl>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {fields.length > 1 ? (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                onClick={(event) => {
                  event.preventDefault();
                  remove(index);
                }}
                className="gap-2 text-2"
              >
                <Cross2Icon />
                {tAgreementFlow('plugins.airdrop.remove')}
              </Button>
            </div>
          ) : null}
        </div>
      ))}

      <div className="flex justify-end w-full">
        <Button
          className="w-fit"
          variant="ghost"
          disabled={!canAddMore}
          onClick={(event) => {
            event.preventDefault();
            if (!canAddMore) return;
            // Copy the first recipient's amount as the default for new rows.
            const firstAmount =
              (getValues(`${name}.recipients.0.amount`) as string) ?? '';
            append({ ...DEFAULT_RECIPIENT, amount: firstAmount });
          }}
        >
          <PlusIcon />
          {tAgreementFlow('plugins.airdrop.add')}
        </Button>
      </div>
    </div>
  );
};
