'use client';

import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@hypha-platform/ui';
import { TokenSelector } from './token-selector';

interface Token {
  icon: string;
  symbol: string;
  address: `0x${string}`;
}

interface TokenSelectorFieldProps {
  name: string;
  tokens: Token[];
  showRequirementMark?: boolean;
}

export function TokenSelectorField({
  name,
  tokens,
  showRequirementMark = false,
}: TokenSelectorFieldProps) {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <TokenSelector
              value={field.value}
              onChange={(tokenAddress) => field.onChange(tokenAddress)}
              tokens={tokens}
              showRequirementMark={showRequirementMark}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
