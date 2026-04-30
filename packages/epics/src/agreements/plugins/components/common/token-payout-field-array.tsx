'use client';

import React from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { TokenPayoutField } from './token-payout-field';
import {
  Button,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  RequirementMark,
} from '@hypha-platform/ui';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { TokenType } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';

export interface Token {
  icon: string;
  symbol: string;
  address: `0x${string}`;
  value?: number;
  tokenPrice?: number;
  space?: {
    title: string;
    slug: string;
  };
  type?: TokenType | null;
}

interface TokenPayoutFieldArrayProps {
  tokens: Token[];
  name?: string;
  /** Single-line label (default). Ignored if `labelLines` is set. */
  label?: string;
  /** Two-line label, e.g. "Investing member" / "will send" — requirement mark follows line 2. */
  labelLines?: readonly [string, string];
  allowAddOrRemove?: boolean;
  showSelectedTokenBalanceHint?: boolean;
  showTreasuryBalanceHint?: boolean;
  selectedTokenPriceHint?: string;
  isLoadingTokens?: boolean;
  loadingTokensLabel?: string;
}

function TokenPayoutFieldArrayInner({
  tokens,
  name = 'payouts',
  label,
  labelLines,
  allowAddOrRemove = true,
  showSelectedTokenBalanceHint = false,
  showTreasuryBalanceHint = false,
  selectedTokenPriceHint,
  isLoadingTokens = false,
  loadingTokensLabel,
}: TokenPayoutFieldArrayProps) {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const resolvedLabel =
    label ?? tAgreementFlow('plugins.tokenPayoutFieldArray.paymentRequest');
  const useTwoLineLabel = Boolean(labelLines?.[0] && labelLines?.[1]);
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  const handleAddField = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    append({ amount: '', token: '' as `0x${string}` });
  };

  const handleDeleteField = (
    e: React.MouseEvent<HTMLButtonElement>,
    index: number,
  ) => {
    e.preventDefault();
    if (fields.length > 1) {
      remove(index);
    }
  };

  const fieldRows = fields.map((field, index) => (
    <div key={field.id} className="flex md:justify-end gap-2">
      <div className="">
        <FormField
          control={control}
          name={`${name}.${index}`}
          render={({ field: { value, onChange } }) => (
            <FormItem>
              <FormControl>
                <TokenPayoutField
                  value={value}
                  onChange={onChange}
                  tokens={tokens}
                  showSelectedTokenBalanceHint={
                    showSelectedTokenBalanceHint || showTreasuryBalanceHint
                  }
                  useTreasuryBalanceLine={showTreasuryBalanceHint}
                  selectedTokenPriceHint={selectedTokenPriceHint}
                  isLoadingTokens={isLoadingTokens}
                  loadingTokensLabel={loadingTokensLabel}
                />
              </FormControl>
              {/*
                Render the actual amount/token error messages instead of a
                single consolidated copy. The previous `custom` override (i18n
                key `enterAmountAndToken`) hid every row-level error behind
                "Please enter an amount and select a token." — including
                async manual errors set by `useSellerLegBalanceValidation`
                like "Seller amount exceeds balance" / "Amount too small".
                Specific messages are clearer; an empty row simply shows the
                two leaf messages ("Please enter an amount." and "Please
                select a token") on separate lines.
              */}
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      {allowAddOrRemove && (
        <Button
          variant="ghost"
          onClick={(ev) => handleDeleteField(ev, index)}
          className="px-2 md:px-3"
        >
          <Cross2Icon />
        </Button>
      )}
    </div>
  ));

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-col gap-4 md:flex-row md:items-start w-full">
        <label
          className={`text-2 text-neutral-11 shrink-0 leading-snug ${
            useTwoLineLabel
              ? 'max-w-[12rem] pt-0.5'
              : 'whitespace-nowrap md:min-w-max md:pt-1'
          }`}
        >
          {useTwoLineLabel ? (
            <>
              <span className="block">{labelLines![0]}</span>
              <span className="block">
                {labelLines![1]} <RequirementMark />
              </span>
            </>
          ) : (
            <>
              {resolvedLabel} <RequirementMark />
            </>
          )}
        </label>
        <div className="flex flex-col gap-2 grow min-w-0 self-stretch md:self-start">
          {fieldRows}
        </div>
      </div>
      {allowAddOrRemove && (
        <div className="flex justify-end w-full">
          <Button className="w-fit" onClick={handleAddField} variant="ghost">
            <PlusIcon />
            {tAgreementFlow('plugins.tokenPayoutFieldArray.add')}
          </Button>
        </div>
      )}
    </div>
  );
}

export const TokenPayoutFieldArray = React.memo(TokenPayoutFieldArrayInner);
