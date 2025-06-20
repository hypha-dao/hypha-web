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
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { zeroAddress } from 'viem';

type EntryMethodOption = {
  name: string;
  value: number;
};

const entryMethods: EntryMethodOption[] = [
  {
    name: 'Open Access',
    value: EntryMethodType.OPEN_ACCESS,
  },
  {
    name: 'Invite Only',
    value: EntryMethodType.INVITE_ONLY,
  },
  {
    name: 'Token Based',
    value: EntryMethodType.TOKEN_BASED,
  },
];

export const ChangeEntryMethodPlugin = (_props: {
  spaceSlug: string;
  members: Person[];
}) => {
  const [tokenBased, setTokenBased] = useState(false);
  const { tokens, isLoading } = useTokens({ spaceSlug: _props.spaceSlug });
  const { getValues, control } = useFormContext();

  return (
    <div className="flex flex-col gap-4">
      <EntryMethodField
        entryMethods={entryMethods}
        value={getValues().entryMethod}
        onChange={(selected) => {
          setTokenBased(selected.value === EntryMethodType.TOKEN_BASED);
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
