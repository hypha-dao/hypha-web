'use client';

import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  RequirementMark,
} from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';
import { Token } from '@hypha-platform/core/client';

interface ExtendedToken extends Token {
  space?: {
    title: string;
    slug: string;
  };
}

type SpaceTokenFieldProps = {
  filteredTokens: ExtendedToken[];
};

export function SpaceTokenField({ filteredTokens }: SpaceTokenFieldProps) {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="tokenBackingVault.spaceToken"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center w-full">
            <div className="flex gap-1 w-full">
              <label className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
                Select Token
              </label>
              <RequirementMark className="text-2" />
            </div>
            <FormControl>
              <Select
                onValueChange={field.onChange}
                value={field.value || ''}
                disabled={filteredTokens.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      filteredTokens.length === 0
                        ? 'No token found'
                        : 'Select a token'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredTokens.map((token: ExtendedToken) => (
                    <SelectItem key={token.address} value={token.address}>
                      {token.symbol} - {token.name}
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
