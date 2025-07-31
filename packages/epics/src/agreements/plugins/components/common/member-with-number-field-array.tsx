'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { MemberWithNumberField } from './member-with-number';
import {
  Button,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  Separator,
} from '@hypha-platform/ui';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { Text } from '@radix-ui/themes';
import { Person } from '@hypha-platform/core/client';

interface MemberWithNumberFieldFieldArrayProps {
  members: Person[];
  name?: string;
}

export const MemberWithNumberFieldFieldArray = ({
  members,
  name = 'members',
}: MemberWithNumberFieldFieldArrayProps) => {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });
  const handleAddField = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    append({ member: null, number: '' });
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
    <div className="flex flex-col gap-4">
      <Separator />
      <div className="flex flex-col md:flex-row gap-4">
        <Text className="pt-1 text-2 text-neutral-11 text-nowrap">
          Initial voice allocation
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
              <Button
                variant="ghost"
                onClick={(ev) => handleDeleteField(ev, index)}
              >
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
      </div>
    </div>
  );
};
