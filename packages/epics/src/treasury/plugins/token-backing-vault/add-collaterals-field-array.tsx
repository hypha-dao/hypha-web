'use client';

import { FormLabel, FormControl, Button } from '@hypha-platform/ui';
import { TokenPayoutField } from '../../../agreements/plugins/components/common/token-payout-field';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { PlusIcon, Cross2Icon } from '@radix-ui/react-icons';
import { TOKENS, Token } from '@hypha-platform/core/client';

interface ExtendedToken extends Token {
  space?: {
    title: string;
    slug: string;
  };
}

const DEFAULT_COLLATERAL_ENTRY = { token: '', amount: '' };

type AddCollateralsFieldArrayProps = {
  filteredTokens: ExtendedToken[];
};

export function AddCollateralsFieldArray({
  filteredTokens,
}: AddCollateralsFieldArrayProps) {
  const { control, setValue, getValues } = useFormContext();
  const collateralTokens: ExtendedToken[] = [...TOKENS, ...filteredTokens];

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'tokenBackingVault.addCollaterals',
  });

  return (
    <div className="flex flex-col gap-4">
      <FormLabel>Add Collaterals to Vault</FormLabel>
      <span className="text-2 text-neutral-11">
        Add backing collaterals from the treasury to the vault.
      </span>
      <div className="flex flex-col gap-3">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="flex flex-col gap-4 rounded-xl border border-neutral-6 p-4"
          >
            <div className="flex justify-between items-center w-full flex-col gap-4">
              <div className="flex gap-1 w-full">
                <span className="text-2 text-neutral-11 whitespace-nowrap items-center w-full">
                  Backing Collateral
                </span>
              </div>
              <FormControl className="w-full">
                <TokenPayoutField
                  value={
                    getValues(`tokenBackingVault.addCollaterals.${index}`) ||
                    DEFAULT_COLLATERAL_ENTRY
                  }
                  onChange={(val) =>
                    setValue(`tokenBackingVault.addCollaterals.${index}`, val)
                  }
                  tokens={
                    collateralTokens as Parameters<
                      typeof TokenPayoutField
                    >[0]['tokens']
                  }
                />
              </FormControl>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault();
                  remove(index);
                }}
                className="gap-2 text-2"
              >
                <Cross2Icon />
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-start md:justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={(e) => {
            e.preventDefault();
            append(DEFAULT_COLLATERAL_ENTRY);
          }}
          className="gap-2 text-2"
        >
          <PlusIcon />
          Add
        </Button>
      </div>
    </div>
  );
}
