'use client';

import {
  Separator,
  Skeleton,
  RequirementMark,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  Input,
  FormLabel,
} from '@hypha-platform/ui';
import { TokenPayoutField } from '../../../agreements/plugins/components/common/token-payout-field';
import { useTokens, useTokenSupply } from '../../hooks';
import { useFormContext } from 'react-hook-form';
import { DbToken, Token } from '@hypha-platform/core/client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useDbTokens } from '../../../hooks';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';

interface ExtendedToken extends Token {
  space?: {
    title: string;
    slug: string;
  };
}

export const MintTokensToSpaceTreasuryPlugin = ({
  spaceSlug,
}: {
  spaceSlug: string;
}) => {
  const { lang } = useParams();
  const { control, setValue, watch, getValues } = useFormContext();
  const { tokens, isLoading } = useTokens({ spaceSlug });
  const filteredTokens = tokens.filter(
    (t: ExtendedToken) => t?.space?.slug === spaceSlug,
  );
  const mint = watch('mint');
  const mintTokenIsSelected = mint?.token;
  const amount = mint?.amount;
  const { tokens: dbTokens } = useDbTokens();

  const selectedToken = dbTokens
    .filter((t: DbToken) => t.address)
    .find(
      (t: DbToken) =>
        t.address?.toLowerCase() === getValues('mint.token')?.toLowerCase(),
    );
  const { supply, isLoading: isLoadingSupply } = useTokenSupply(
    selectedToken?.address as `0x${string}`,
  );
  return (
    <div className="flex flex-col gap-4">
      <Skeleton loading={isLoading} width={'100%'} height={90}>
        <div className="flex flex-col gap-4">
          <FormLabel>Mint to Space Treasury</FormLabel>
          <span className="text-2 text-neutral-11">
            Mint tokens into your space treasury to fund operations, distribute
            rewards, or provide liquidity.{' '}
          </span>
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-start w-full">
          <div className="flex gap-1">
            <label className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
              Select Token
            </label>
            <RequirementMark className="text-2" />
          </div>
          <div className="flex flex-col gap-2 grow min-w-0">
            <div className="flex md:justify-end">
              <FormField
                control={control}
                name="mint"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <TokenPayoutField
                        value={field.value}
                        onChange={(val) => setValue('mint', val)}
                        tokens={filteredTokens}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>
        {mintTokenIsSelected && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between">
              <span className="text-2 text-neutral-11 w-full">
                Token Supply
              </span>
              {selectedToken?.maxSupply == 0 ? (
                <span className="text-2 text-neutral-11 text-nowrap">
                  Unlimited Supply
                </span>
              ) : (
                <span className="text-2 text-neutral-11">
                  {formatCurrencyValue(selectedToken?.maxSupply as number)}
                </span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-2 text-neutral-11 w-full">
                Issuance to Date
              </span>
              <Skeleton width={120} height={32} loading={isLoadingSupply}>
                <span className="text-2 text-neutral-11">
                  {formatCurrencyValue(supply)}
                </span>
              </Skeleton>
            </div>
            {selectedToken?.maxSupply != 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-2 text-neutral-11 w-full">
                    Mint Amount Limit
                  </span>
                  <span className="text-2 text-neutral-11">
                    {formatCurrencyValue(
                      Number(selectedToken?.maxSupply) - Number(supply),
                    )}
                  </span>
                </div>
                {Number(amount) >
                  Number(selectedToken?.maxSupply) - Number(supply) && (
                  <div className="text-2 text-foreground">
                    The number of tokens requested exceeds the Mint Amount
                    Limit. Please enter a value up to{' '}
                    {Number(selectedToken?.maxSupply) - Number(supply)}
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {filteredTokens.length === 0 && (
          <div className="text-2 text-foreground">
            Your space has not yet created a token,{' '}
            <Link
              href={`/${lang}/dho/${spaceSlug}/agreements/create/issue-new-token`}
              className="text-accent-9 underline"
              onClick={(e) => e.stopPropagation()}
            >
              click here
            </Link>{' '}
            to first issue a token
          </div>
        )}
      </Skeleton>
    </div>
  );
};
