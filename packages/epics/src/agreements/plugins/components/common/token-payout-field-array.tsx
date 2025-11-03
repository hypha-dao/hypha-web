'use client';

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

export interface Token {
  icon: string;
  symbol: string;
  address: `0x${string}`;
  space?: {
    title: string;
    slug: string;
  };
  type?: TokenType | null;
}

interface TokenPayoutFieldArrayProps {
  tokens: Token[];
  name?: string;
  label?: string;
}

export const TokenPayoutFieldArray = ({
  tokens,
  name = 'payouts',
  label = 'Payment Request',
}: TokenPayoutFieldArrayProps) => {
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

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-col gap-4 md:flex-row md:items-start w-full">
        <label className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
          {label} <RequirementMark />
        </label>
        <div className="flex flex-col gap-2 grow min-w-0">
          {fields.map((field, index) => (
            <div key={field.id} className="flex md:justify-end gap-2">
              <div className="">
                <FormField
                  control={control}
                  name={`${name}.${index}`}
                  render={({ field: { value, onChange } }) => (
                    <FormItem>
                      {/* @ts-expect-error Server Component */}
                      <FormControl>
                        <TokenPayoutField
                          value={value}
                          onChange={onChange}
                          tokens={tokens}
                        />
                      </FormControl>
                      <FormMessage custom="Please enter an amount and select a token." />
                    </FormItem>
                  )}
                />
              </div>
              <Button
                variant="ghost"
                onClick={(ev) => handleDeleteField(ev, index)}
                className="px-2 md:px-3"
              >
                <Cross2Icon />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end w-full">
        <Button className="w-fit" onClick={handleAddField} variant="ghost">
          <PlusIcon />
          Add
        </Button>
      </div>
    </div>
  );
};
