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
import { useTranslations } from 'next-intl';

interface SpaceWithNumberOfMonthsFieldArrayProps {
  spaces: Space[];
  organisationSpaces?: Space[];
  name?: string;
  appearance?: 'default' | 'wallet';
}

interface SpaceFieldError extends FieldError {
  spaceId?: FieldError;
  months?: FieldError;
}

export const SpaceWithNumberOfMonthsFieldArray = ({
  spaces,
  organisationSpaces = [],
  name = 'spaces',
  appearance = 'default',
}: SpaceWithNumberOfMonthsFieldArrayProps) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
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
    append({ spaceId: 0, months: 3 });
  };

  const handleRemoveLastField = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (fields.length > 1) {
      remove(fields.length - 1);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <Label>{tAgreementFlow('plugins.spaceWithMonths.spaces')}</Label>
      <div className="flex w-full justify-between items-center">
        <span className="text-2 text-neutral-11 w-full">
          {tAgreementFlow('plugins.spaceWithMonths.contribution')}
        </span>
        <span className="text-2 text-neutral-11 text-nowrap">
          {tAgreementFlow(
            'plugins.spaceWithMonths.contributionPerMonthPerSpace',
          )}
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
                          appearance={appearance}
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

        <div
          className={
            appearance === 'wallet'
              ? 'flex w-full flex-col gap-2'
              : 'flex w-full justify-end gap-1'
          }
        >
          <Button
            className={appearance === 'wallet' ? 'w-full' : 'w-fit'}
            onClick={handleRemoveLastField}
            variant={appearance === 'wallet' ? 'outline' : 'ghost'}
            disabled={fields.length <= 1}
            colorVariant="error"
          >
            <MinusIcon />
            {tAgreementFlow('plugins.spaceWithMonths.removeSpace')}
          </Button>
          <Button
            className={appearance === 'wallet' ? 'w-full' : 'w-fit'}
            onClick={handleAddField}
            variant={appearance === 'wallet' ? 'outline' : 'ghost'}
          >
            <PlusIcon />
            {tAgreementFlow('plugins.spaceWithMonths.addSpace')}
          </Button>
        </div>
      </div>
    </div>
  );
};
