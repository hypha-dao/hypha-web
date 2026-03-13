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

interface TokenItem {
  name?: string;
  symbol?: string;
  address?: string;
  iconUrl?: string;
}

type SelectTokenFieldProps = {
  name: string;
  label: string;
  tokens: TokenItem[];
  required?: boolean;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  emptyListMessage?: string;
};

export function SelectTokenField({
  name,
  label,
  tokens,
  required = false,
  onValueChange,
  placeholder = 'Select a token',
  emptyListMessage = 'No tokens available',
}: SelectTokenFieldProps) {
  const { control } = useFormContext();

  const isEmpty = tokens.length === 0;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center">
            <FormLabel className="text-2 text-neutral-11 w-full gap-1">
              {label} {required && <RequirementMark className="text-2" />}
            </FormLabel>
            <FormControl>
              {isEmpty ? (
                <div className="text-2 text-neutral-11 italic">
                  {emptyListMessage}
                </div>
              ) : (
                <Select
                  value={field.value}
                  onValueChange={(value: string) => {
                    field.onChange(value);
                    onValueChange?.(value);
                  }}
                >
                  <SelectTrigger className="h-auto">
                    <SelectValue placeholder={placeholder} />
                  </SelectTrigger>
                  <SelectContent className="p-2">
                    {tokens.map(({ name, symbol, address, iconUrl }) => (
                      <SelectItem key={address} value={address!}>
                        <div className="flex flex-col text-left">
                          <span className="text-1 font-medium">
                            {symbol} - {name}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
