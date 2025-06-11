'use client';

import { Address, EntryMethodType, Person } from "@hypha-platform/core/client";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@hypha-platform/ui";
import { EntryMethodTokenField } from "packages/epics/src/spaces";
import { EntryMethodField } from "packages/epics/src/spaces/components/entry-method-field";
import { useTokens } from "packages/epics/src/treasury";
import { useState } from "react";
import { useFormContext } from "react-hook-form";

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

export const ChangeEntryMethodPlugin = ({}: {
  spaceSlug: string;
  members: Person[];
}) => {
  const [tokenBased, setTokenBased] = useState(false);
  const { tokens } = useTokens();
  const { getValues, control } = useFormContext();

  return (
    <div className="flex flex-col gap-4">
      <EntryMethodField
        entryMethods={entryMethods}
        value={getValues().entryMethod}
        onChange={(selected) => {
          console.log('selected', selected);
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
                    <EntryMethodTokenField
                      value={{
                        amount: value?.amount || 0,
                        token: (value?.token ||
                          tokens[0]?.address ||
                          '0x0') as Address,
                      }}
                      onChange={onChange}
                      tokens={tokens}
                    />
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
