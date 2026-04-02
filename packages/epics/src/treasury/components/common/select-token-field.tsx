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
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface TokenItem {
  name?: string;
  symbol?: string;
  address: string;
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
  placeholder,
  emptyListMessage,
}: SelectTokenFieldProps) {
  const { control } = useFormContext();
  const tTreasury = useTranslations('TreasuryTab');
  const [brokenIcons, setBrokenIcons] = useState<Record<string, boolean>>({});

  const isEmpty = tokens.length === 0;
  const placeholderText = placeholder ?? tTreasury('selectTokenPlaceholder');
  const emptyText = emptyListMessage ?? tTreasury('noTokensAvailable');

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        /** Radix Select matches value to Item value exactly; normalize to lowercase so checksummed DB/session values still match. */
        const rawVal =
          typeof field.value === 'string' ? field.value.trim() : '';
        const selectValue =
          rawVal && rawVal.startsWith('0x')
            ? rawVal.toLowerCase()
            : rawVal || undefined;

        return (
          <FormItem>
            <div className="flex justify-between items-center">
              <FormLabel className="text-2 text-neutral-11 w-full gap-1">
                {label} {required && <RequirementMark className="text-2" />}
              </FormLabel>
              <FormControl>
                {isEmpty ? (
                  <div className="text-2 text-neutral-11 italic">
                    {emptyText}
                  </div>
                ) : (
                  <Select
                    value={selectValue}
                    onValueChange={(value: string) => {
                      field.onChange(value);
                      onValueChange?.(value);
                    }}
                  >
                    <SelectTrigger className="h-auto">
                      <SelectValue placeholder={placeholderText} />
                    </SelectTrigger>
                    <SelectContent className="p-2">
                      {tokens.map(({ name, symbol, address, iconUrl }) => {
                        const fallback = '/placeholder/token-icon.svg';
                        const raw = iconUrl?.trim();
                        const itemValue =
                          typeof address === 'string' &&
                          address.startsWith('0x')
                            ? address.toLowerCase()
                            : address;
                        const src =
                          brokenIcons[itemValue] || !raw ? fallback : raw;
                        return (
                          <SelectItem key={itemValue} value={itemValue}>
                            <div className="flex items-center gap-2 text-left text-sm leading-5">
                              <img
                                src={src}
                                alt=""
                                className="h-5 w-5 shrink-0 rounded-full object-cover"
                                loading="lazy"
                                draggable={false}
                                onError={() =>
                                  setBrokenIcons((prev) => ({
                                    ...prev,
                                    [itemValue]: true,
                                  }))
                                }
                              />
                              <span className="font-medium">
                                {symbol ?? 'Unknown'} -{' '}
                                {name ?? 'Unknown Token'}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
