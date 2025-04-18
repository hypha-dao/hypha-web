import { Button } from '@hypha-platform/ui';
import { TokenPayoutField, Token } from './token-payout-field';
import { PlusIcon } from '@radix-ui/react-icons';
import { useFieldArray, useFormContext } from 'react-hook-form';
import React from 'react';

interface TokenPayoutFieldArrayProps {
  tokens: Token[];
  name?: string;
}

export const TokenPayoutFieldArray = ({
  tokens,
  name = 'payouts',
}: TokenPayoutFieldArrayProps) => {
  const { control, watch } = useFormContext();

  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  // Watch the entire field array for changes
  const payouts = watch(name);
  console.debug('TokenPayoutFieldArray', { payouts });

  const handleAddField = React.useCallback(() => {
    append({ amount: '', token: null });
  }, []);

  return (
    <div className="flex flex-col gap-2 w-full">
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-end gap-2">
          <div className="flex-1">
            <TokenPayoutField
              arrayFieldName={name}
              arrayFieldIndex={index}
              tokens={tokens}
            />
          </div>
          <Button
            variant="ghost"
            colorVariant="error"
            onClick={() => remove(index)}
          >
            Remove
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
