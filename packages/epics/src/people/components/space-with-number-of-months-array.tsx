'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import {
  Button,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  Label,
} from '@hypha-platform/ui';
import { PlusIcon, MinusIcon } from '@radix-ui/react-icons';
import { Space } from '@hypha-platform/core/client';
import { SpaceWithNumberOfMonthsField } from './space-with-number-of-months';

interface SpaceWithNumberOfMonthsFieldArrayProps {
  spaces: Space[];
  name?: string;
}

export const SpaceWithNumberOfMonthsFieldArray = ({
  spaces,
  name = 'spaces',
}: SpaceWithNumberOfMonthsFieldArrayProps) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  const handleAddField = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    append({ spaceId: 0, months: 0 });
  };

  const handleRemoveLastField = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (fields.length > 1) {
      remove(fields.length - 1);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <Label>Space(s)</Label>
      <div className="flex w-full justify-between items-center">
        <span className="text-2 text-neutral-11 w-full">Contribution:</span>
        <span className="text-2 text-neutral-11 text-nowrap">
          $11 per month per space
        </span>
      </div>
      <div className="flex flex-col gap-4">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <div className="flex-1">
              <FormField
                control={control}
                name={`${name}.${index}`}
                render={({ field: { value, onChange } }) => (
                  <FormItem>
                    <FormControl>
                      <SpaceWithNumberOfMonthsField
                        spaces={spaces}
                        value={value}
                        onChange={onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        ))}

        <div className="flex justify-end w-full gap-1">
          <Button
            className="w-fit"
            onClick={handleRemoveLastField}
            variant="ghost"
            disabled={fields.length <= 1}
            colorVariant="error"
          >
            <MinusIcon />
            Remove Space
          </Button>
          <Button className="w-fit" onClick={handleAddField} variant="ghost">
            <PlusIcon />
            Add space
          </Button>
        </div>
      </div>
    </div>
  );
};
