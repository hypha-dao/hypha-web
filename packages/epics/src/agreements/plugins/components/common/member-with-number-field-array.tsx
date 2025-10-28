'use client';

import { useFormContext, useFieldArray, useWatch } from 'react-hook-form';
import { MemberWithNumberField } from './member-with-number';
import {
  Button,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  RequirementMark,
} from '@hypha-platform/ui';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { Text } from '@radix-ui/themes';
import { Person } from '@hypha-platform/core/client';
import React from 'react';
import { AssetItem } from '../../../../treasury';

interface MemberWithNumberFieldFieldArrayProps {
  members: Person[];
  name?: string;
  assets: AssetItem[];
}

export const MemberWithNumberFieldFieldArray = ({
  members,
  name = 'members',
  assets,
}: MemberWithNumberFieldFieldArrayProps) => {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  const tokenAddress = useWatch({
    control,
    name: 'token',
  }) as string | undefined;

  const selectedToken = React.useMemo(() => {
    if (!tokenAddress) return undefined;
    return assets?.find(
      (t) => t.address?.toLowerCase() === tokenAddress.toLowerCase(),
    );
  }, [assets, tokenAddress]);

  const hasZeroSupply = React.useMemo(() => {
    return !selectedToken?.supply?.total;
  }, [selectedToken]);

  const shouldShowFields = !!selectedToken;

  React.useEffect(() => {
    if (!shouldShowFields) {
      if (fields.length > 0) {
        remove();
      }
      return;
    }
    if (hasZeroSupply) {
      if (fields.length === 0) {
        append({ member: null, number: '' });
      }
    } else {
      if (fields.length > 0) {
        remove();
      }
    }
  }, [shouldShowFields, hasZeroSupply, append, remove, fields.length]);

  const handleAddField = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    append({ member: null, number: '' });
  };

  const handleDeleteField = (
    e: React.MouseEvent<HTMLButtonElement>,
    index: number,
  ) => {
    e.preventDefault();
    if (index === 0 && hasZeroSupply) return;

    if (fields.length > 1) {
      remove(index);
    } else {
      remove(index);
    }
  };

  if (!shouldShowFields) {
    return null;
  }

  if (!hasZeroSupply && fields.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4">
          <Text className="flex gap-2 pt-1 text-2 text-neutral-11 text-nowrap">
            Initial allocation
          </Text>
          <div className="flex flex-col gap-2">
            <div className="flex justify-end w-full">
              <Button
                className="w-fit"
                onClick={handleAddField}
                variant="ghost"
              >
                <PlusIcon />
                Add
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row gap-4">
        <Text className="flex gap-2 pt-1 text-2 text-neutral-11 text-nowrap">
          Initial allocation
          {hasZeroSupply && <RequirementMark />}
        </Text>
        <div className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <div className="flex-1">
                <FormField
                  control={control}
                  name={`${name}.${index}`}
                  render={({ field: { value, onChange } }) => (
                    <FormItem>
                      <FormControl>
                        <MemberWithNumberField
                          members={members}
                          value={value}
                          onChange={onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {(hasZeroSupply && index !== 0) || !hasZeroSupply ? (
                <Button
                  variant="ghost"
                  onClick={(ev) => handleDeleteField(ev, index)}
                >
                  <Cross2Icon />
                </Button>
              ) : null}
            </div>
          ))}
          <div className="flex justify-end w-full">
            <Button className="w-fit" onClick={handleAddField} variant="ghost">
              <PlusIcon />
              Add
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
