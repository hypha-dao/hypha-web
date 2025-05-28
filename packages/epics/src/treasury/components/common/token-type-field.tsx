'use client';

import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@hypha-platform/ui';

const TOKEN_TYPE_OPTIONS = [
  {
    value: 'utility',
    label: 'Utility Token',
    description: 'used for access or functionality within the space',
  },
  {
    value: 'credits',
    label: 'Cash Credits',
    description: 'redeemable credits that can be exchanged for fiat currency',
  },
  {
    value: 'ownership',
    label: 'Ownership Token',
    description: 'reflects stake or equity in the space',
  },
  {
    value: 'voice',
    label: 'Voice Token',
    description:
      'provides a voice in management or decision making within the space',
  },
];

export function TokenTypeField() {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="type"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center">
            <FormLabel className="text-2 text-neutral-11 w-full">
              Token Type
            </FormLabel>
            <FormControl>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a token type" />
                </SelectTrigger>
                <SelectContent className="p-2">
                  {TOKEN_TYPE_OPTIONS.map(({ value, label, description }) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex flex-col text-left">
                        <span className="text-1 font-medium">{label}</span>
                        <span className="text-1 text-neutral-11">
                          {description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
