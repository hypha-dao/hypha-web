'use client';

import { useFormContext, useFieldArray, FieldError } from 'react-hook-form';
import {
  Button,
  FormField,
  FormItem,
  FormControl,
  Label,
} from '@hypha-platform/ui';
import { PlusIcon, MinusIcon } from '@radix-ui/react-icons';
import { Space } from '@hypha-platform/core/client';
import { SpaceWithNumberOfMonthsField } from './space-with-number-of-months';

interface SpaceWithNumberOfMonthsFieldArrayProps {
  spaces: Space[];
  organisationSpaces?: Space[];
  name?: string;
}

interface SpaceFieldError extends FieldError {
  spaceId?: FieldError;
  months?: FieldError;
}

export const SpaceWithNumberOfMonthsFieldArray = ({
  spaces,
  organisationSpaces = [],
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
                render={({
                  field: { value, onChange },
                  fieldState: { error },
                }) => {
                  const spaceError = error as SpaceFieldError;
                  return (
                    <FormItem>
                      <FormControl>
                        <SpaceWithNumberOfMonthsField
                          spaces={spaces}
                          organisationSpaces={organisationSpaces}
                          value={value}
                          onChange={onChange}
                          name={`${name}.${index}`}
                        />
                      </FormControl>
                      {spaceError?.spaceId?.message && (
                        <span className="text-error-11 text-1 block">
                          {spaceError.spaceId.message}
                        </span>
                      )}
                      {spaceError?.months?.message && (
                        <span className="text-error-11 text-1 block">
                          {spaceError.months.message}
                        </span>
                      )}
                    </FormItem>
                  );
                }}
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
