'use client';

import { useFieldArray, useFormContext } from 'react-hook-form';
import { AssetItem } from '../../../../treasury';
import {
  Button,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  RequirementMark,
} from '@hypha-platform/ui';
import { TokenPercentageField } from './token-percentage-field';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';

export interface TokenPercentageFieldArrayProps {
  assets: AssetItem[];
  name?: string;
  label?: string;
}

export const TokenPercentageFieldArray = ({
  assets,
  name = 'conversions',
  label = 'Converted into',
}: TokenPercentageFieldArrayProps) => {
  const {
    control,
    formState: { errors: formErrors },
  } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  const handleAddField = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    append({ percentage: '0.00', asset: '' as `0x${string}` });
  };

  const handleRemoveField = (
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
                  render={({ field: { value, onChange }, formState }) => (
                    <FormItem>
                      <FormControl>
                        <TokenPercentageField
                          value={value}
                          onChange={onChange}
                          assets={assets}
                        />
                      </FormControl>
                      <FormMessage
                        custom={
                          formState.errors?.percentage?.message?.toString() ||
                          'Please enter a percentage and select an asset.'
                        }
                      />
                    </FormItem>
                  )}
                />
              </div>
              <Button
                variant="ghost"
                onClick={(ev) => handleRemoveField(ev, index)}
                className="px-2 md:px-3"
              >
                <Cross2Icon />
              </Button>
            </div>
          ))}
          {formErrors.conversions?.root?.message && (
            <FormMessage>
              {formErrors.conversions?.root?.message?.toString()}
            </FormMessage>
          )}
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
