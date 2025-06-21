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
import { Person } from '@core/people';

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

  return (
    <div className="flex flex-col gap-5">
      <Separator />
      <Text className="text-2 text-neutral-11">Initial voice allocation</Text>
      <div className="flex flex-col gap-2 w-full items-end">
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
    </div>
  );
};
