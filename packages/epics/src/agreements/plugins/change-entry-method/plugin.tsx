'use client';

import {
  Address,
  EntryMethodType,
  Person,
  useSpaceDetailsWeb3Rpc,
} from '@hypha-platform/core/client';
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
  web3SpaceId,
}: {
  spaceSlug: string;
  members: Person[];
  web3SpaceId?: number | null;
}) => {
  const [tokenBased, setTokenBased] = React.useState(false);
  const { tokens, isLoading } = useTokens({ spaceSlug });
  const { setValue, control } = useFormContext();
  const { spaceDetails, isLoading: isSpaceDetailsLoading } =
    useSpaceDetailsWeb3Rpc({ spaceId: web3SpaceId as number });

  const entryMethod = useWatch({
    control,
    name: 'entryMethod',
    defaultValue: EntryMethodType.OPEN_ACCESS,
  });

  React.useEffect(() => {
    if (spaceDetails && !isLoading) {
      const entryMethod =
        spaceDetails?.joinMethod ?? EntryMethodType.OPEN_ACCESS;
      setValue('entryMethod', entryMethod);
    }
  }, [spaceDetails, isSpaceDetailsLoading]);

  return (
    <div className="flex flex-col gap-4">
      <EntryMethodField
        value={entryMethod as EntryMethodType}
        onChange={(selected) => {
          setTokenBased(selected === EntryMethodType.TOKEN_BASED);
          setValue('entryMethod', selected);
        }}
        isLoading={isSpaceDetailsLoading}
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
