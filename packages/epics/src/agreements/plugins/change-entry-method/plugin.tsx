'use client';

import { Address, EntryMethodType, Person } from '@hypha-platform/core/client';
import {
  EntryMethodField,
  EntryMethodTokenField,
  useTokens,
} from '@hypha-platform/epics';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Skeleton,
} from '@hypha-platform/ui';
import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { zeroAddress } from 'viem';

export const ChangeEntryMethodPlugin = ({
  spaceSlug,
}: {
  spaceSlug: string;
  members: Person[];
}) => {
  const [tokenBased, setTokenBased] = React.useState(false);
  const { tokens, isLoading } = useTokens({ spaceSlug });
  const { setValue, control } = useFormContext();

  const entryMethod = useWatch({
    control,
    name: 'entryMethod',
    defaultValue: EntryMethodType.OPEN_ACCESS,
  });

  React.useEffect(() => {
    setTokenBased(entryMethod === EntryMethodType.TOKEN_BASED);
  }, [entryMethod]);

  return (
    <div className="flex flex-col gap-4">
      <EntryMethodField
        value={entryMethod as EntryMethodType}
        onChange={(selected) => {
          setValue('entryMethod', selected);
        }}
      />
      {tokenBased && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <FormField
              control={control}
              name="tokenBase"
              render={({ field: { value, onChange } }) => (
                <FormItem>
                  <FormControl>
                    <Skeleton loading={isLoading} width={'100%'} height={24}>
                      <EntryMethodTokenField
                        value={{
                          amount: value?.amount || 0,
                          token: (value?.token ||
                            tokens[0]?.address ||
                            zeroAddress) as Address,
                        }}
                        onChange={onChange}
                        tokens={tokens}
                      />
                    </Skeleton>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
};
