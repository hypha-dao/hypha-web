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
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center">
            <FormLabel className="text-2 text-neutral-11 w-full gap-1">
              {label} {required && <RequirementMark className="text-2" />}
            </FormLabel>
            <FormControl>
              {isEmpty ? (
                <div className="text-2 text-neutral-11 italic">{emptyText}</div>
              ) : (
                <Select
                  value={field.value}
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
                      const src = brokenIcons[address] || !raw ? fallback : raw;
                      return (
                        <SelectItem key={address} value={address}>
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
                                  [address]: true,
                                }))
                              }
                            />
                            <span className="font-medium">
                              {symbol ?? 'Unknown'} - {name ?? 'Unknown Token'}
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
      )}
    />
  );
}
