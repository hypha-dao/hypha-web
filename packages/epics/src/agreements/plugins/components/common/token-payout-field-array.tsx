'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { TokenPayoutField } from './token-payout-field';
import {
  Button,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from '@hypha-platform/ui';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';

interface Token {
  icon: string;
  symbol: string;
  name: string;
}

interface TokenPayoutFieldArrayProps {
  tokens: Token[];
  name?: string;
}

export const TokenPayoutFieldArray = ({
  tokens,
  name = 'payouts',
}: TokenPayoutFieldArrayProps) => {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  const handleAddField = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    append({ amount: '', token: '' });
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-end gap-2">
          <div className="flex-1">
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
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button variant="ghost" onClick={() => remove(index)}>
            <Cross2Icon />
          </Button>
        </div>
      ))}
      <div className="flex justify-end w-full">
        <Button className="w-fit" onClick={handleAddField} variant="ghost">
          <PlusIcon />
          Add
        </Button>
      </div>
    </div>
  );
};
