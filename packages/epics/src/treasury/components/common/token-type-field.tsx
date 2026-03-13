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
  RequirementMark,
} from '@hypha-platform/ui';

export const TOKEN_TYPE_OPTIONS = [
  {
    value: 'utility',
    label: 'Utility Token',
    description: 'used for access or functionality within the space',
  },
  {
    value: 'ownership',
    label: 'Ownership Token',
    description: 'reflects stake or equity in the space',
  },
  {
    value: 'impact',
    label: 'Impact Token',
    description:
      'values measurable social, economic, and environmental outcomes',
  },
  {
    value: 'credits',
    label: 'Cash Credits',
    description: 'redeemable credits that can be exchanged for fiat currency',
  },
  {
    value: 'voice',
    label: 'Voice Token',
    description:
      'provides a voice in management or decision making within the space',
  },
  {
    value: 'community_currency',
    label: 'Community Currency',
    description:
      'local currency used for transactions and value exchange within the community',
  },
];

export function getTokenTypeLabel(type: string): string {
  return TOKEN_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function getTokenTypeDescription(type: string): string {
  return TOKEN_TYPE_OPTIONS.find((o) => o.value === type)?.description ?? '';
}

type TokenTypeFieldProps = {
  onValueChange?: (value: string) => void;
};

export function TokenTypeField({ onValueChange }: TokenTypeFieldProps) {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="type"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center">
            <FormLabel className="text-2 text-neutral-11 w-full gap-1">
              Token Type <RequirementMark className="text-2" />
            </FormLabel>
            <FormControl>
              <Select
                value={field.value}
                onValueChange={(value: string) => {
                  field.onChange(value);
                  onValueChange?.(value);
                }}
              >
                <SelectTrigger className="h-auto">
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
