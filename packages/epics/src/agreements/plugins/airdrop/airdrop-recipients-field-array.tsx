'use client';

import React from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import {
  Button,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  FormLabel,
  RequirementMark,
  Separator,
} from '@hypha-platform/ui';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui/server';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { Person, Space } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';

import { RecipientField } from '../components/common/recipient-field';
import { TokenPayoutField } from '../components/common/token-payout-field';
import { Token } from '../components/common/token-payout-field-array';
import { AirdropEntry, MAX_AIRDROP_RECIPIENTS } from './airdrop.validation';

const DEFAULT_ENTRY: AirdropEntry = {
  method: 'transfer',
  recipient: '',
  token: '',
  amount: '',
};

interface AirdropRecipientsFieldArrayProps {
  tokens: Token[];
  members: Person[];
  spaces?: Space[];
  spaceSlug: string;
  name?: string;
}

export const AirdropRecipientsFieldArray = ({
  tokens,
  members,
  spaces,
  spaceSlug,
  name = 'airdrop',
}: AirdropRecipientsFieldArrayProps) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { control, setValue } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });
  const entries = (useWatch({ control, name }) ?? []) as AirdropEntry[];

  /** Tokens created by this space can be minted; everything in the treasury can be transferred. */
  const mintableTokens = React.useMemo(
    () => tokens.filter((token) => token.space?.slug === spaceSlug),
    [tokens, spaceSlug],
  );

  const canAddMore = fields.length < MAX_AIRDROP_RECIPIENTS;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1">
        <FormLabel>
          {tAgreementFlow('plugins.airdrop.recipientsLabel')}
        </FormLabel>
        <RequirementMark className="text-2" />
      </div>

      {fields.map((field, index) => {
        const entry = entries[index] ?? DEFAULT_ENTRY;
        const method = entry.method === 'mint' ? 'mint' : 'transfer';
        const availableTokens = method === 'mint' ? mintableTokens : tokens;

        return (
          <div
            key={field.id}
            className="flex flex-col gap-4 rounded-xl border border-neutral-6 p-4"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <span className="text-2 text-neutral-11">
                {tAgreementFlow('plugins.airdrop.methodLabel')}
              </span>
              <FormField
                control={control}
                name={`${name}.${index}.method`}
                render={({ field: methodField }) => (
                  <Tabs
                    value={methodField.value ?? 'transfer'}
                    onValueChange={(value) => {
                      methodField.onChange(value);
                      // Selected token may no longer be valid for the new method.
                      setValue(`${name}.${index}.token`, '', {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                  >
                    <TabsList triggerVariant="switch">
                      <TabsTrigger variant="switch" value="transfer">
                        {tAgreementFlow('plugins.airdrop.transfer')}
                      </TabsTrigger>
                      <TabsTrigger variant="switch" value="mint">
                        {tAgreementFlow('plugins.airdrop.mint')}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              />
            </div>

            <RecipientField
              name={`${name}.${index}.recipient`}
              members={members}
              spaces={spaces}
              defaultRecipientType="member"
            />

            <Separator />

            <FormField
              control={control}
              name={`${name}.${index}.token`}
              render={() => (
                <FormItem className="flex flex-col gap-2">
                  <div className="flex md:justify-end">
                    <FormControl>
                      <TokenPayoutField
                        value={{ amount: entry.amount, token: entry.token }}
                        onChange={(val) => {
                          setValue(`${name}.${index}.token`, val.token, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          setValue(`${name}.${index}.amount`, val.amount, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
                        tokens={availableTokens}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`${name}.${index}.amount`}
              render={() => (
                <FormItem>
                  <FormMessage />
                </FormItem>
              )}
            />

            {method === 'mint' && mintableTokens.length === 0 ? (
              <span className="text-1 text-neutral-10">
                {tAgreementFlow('plugins.airdrop.noMintableTokens')}
              </span>
            ) : null}

            {fields.length > 1 ? (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  onClick={(event) => {
                    event.preventDefault();
                    remove(index);
                  }}
                  className="gap-2 text-2"
                >
                  <Cross2Icon />
                  {tAgreementFlow('plugins.airdrop.remove')}
                </Button>
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="flex justify-end w-full">
        <Button
          className="w-fit"
          variant="ghost"
          disabled={!canAddMore}
          onClick={(event) => {
            event.preventDefault();
            if (canAddMore) append({ ...DEFAULT_ENTRY });
          }}
        >
          <PlusIcon />
          {tAgreementFlow('plugins.airdrop.add')}
        </Button>
      </div>
    </div>
  );
};
