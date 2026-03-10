'use client';

import {
  Skeleton,
  RequirementMark,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  FormLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Image,
} from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';

type SpaceToken = {
  id: number;
  name: string;
  symbol: string;
  address?: string;
  maxSupply: number;
  type: string;
  referencePrice?: number | null;
  referenceCurrency?: string | null;
  iconUrl?: string | null;
};

type TokenSelectionSectionProps = {
  spaceSlug: string;
  spaceTokens: SpaceToken[];
  selectedToken: SpaceToken | undefined;
  isLoading: boolean;
  isLoadingSupply: boolean;
  supply: number | undefined;
};

export const TokenSelectionSection = ({
  spaceSlug,
  spaceTokens,
  selectedToken,
  isLoading,
  isLoadingSupply,
  supply,
}: TokenSelectionSectionProps) => {
  const { lang } = useParams();
  const { control, setValue } = useFormContext();

  const isLimitedSupply = selectedToken && Number(selectedToken.maxSupply) > 0;

  const tokensAvailableLimit = isLimitedSupply
    ? Math.max(0, Number(selectedToken.maxSupply) - Number(supply ?? 0))
    : undefined;

  return (
    <Skeleton loading={isLoading} width="100%" height={90}>
      <div className="flex flex-col gap-4">
        <FormLabel>Token</FormLabel>
        <span className="text-2 text-neutral-11">
          Choose a token available for purchase in this space.
        </span>

        <div className="flex flex-col gap-4 md:flex-row md:items-start w-full">
          <div className="flex gap-1">
            <label className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
              Token
            </label>
            <RequirementMark className="text-2" />
          </div>
          <div className="flex flex-col gap-2 grow min-w-0">
            <FormField
              control={control}
              name="tokenAddress"
              render={({ field }) => {
                const sel = spaceTokens.find(
                  (t) =>
                    t.address?.toLowerCase() === field.value?.toLowerCase(),
                );
                return (
                  <FormItem>
                    <FormControl>
                      <Select
                        value={field.value ?? ''}
                        onValueChange={(val) => {
                          field.onChange(val);
                          const token = spaceTokens.find(
                            (t) =>
                              t.address?.toLowerCase() === val.toLowerCase(),
                          );
                          if (token?.referencePrice) {
                            setValue(
                              'purchasePrice',
                              String(token.referencePrice),
                            );
                          }
                          if (token?.referenceCurrency) {
                            setValue(
                              'purchaseCurrency',
                              token.referenceCurrency,
                            );
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a token">
                            {sel && (
                              <div className="flex items-center gap-2">
                                <Image
                                  src={
                                    sel.iconUrl || '/placeholder/token-icon.svg'
                                  }
                                  width={20}
                                  height={20}
                                  alt={sel.symbol}
                                  className="rounded-full h-5 w-5 shrink-0"
                                />
                                {sel.name} ({sel.symbol})
                              </div>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {spaceTokens.length === 0 ? (
                            <SelectItem value="__none__" disabled>
                              No token found.
                            </SelectItem>
                          ) : (
                            spaceTokens.map((t) => (
                              <SelectItem
                                key={t.address}
                                value={t.address ?? ''}
                              >
                                <div className="flex items-center gap-2">
                                  <Image
                                    src={
                                      t.iconUrl || '/placeholder/token-icon.svg'
                                    }
                                    width={20}
                                    height={20}
                                    alt={t.symbol}
                                    className="rounded-full h-5 w-5 shrink-0"
                                  />
                                  {t.name} ({t.symbol})
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            {spaceTokens.length === 0 && !isLoading && (
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
          </div>
        </div>

        {selectedToken && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between">
              <span className="text-2 text-neutral-11">Token Supply</span>
              {selectedToken.maxSupply === 0 ? (
                <span className="text-2 text-neutral-11">Unlimited Supply</span>
              ) : (
                <span className="text-2 text-neutral-11">
                  {formatCurrencyValue(selectedToken.maxSupply)}
                </span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-2 text-neutral-11">Issuance to Date</span>
              <Skeleton width={120} height={20} loading={isLoadingSupply}>
                <span className="text-2 text-neutral-11">
                  {formatCurrencyValue(supply ?? 0)}
                </span>
              </Skeleton>
            </div>
            {isLimitedSupply && tokensAvailableLimit !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-2 text-neutral-11">
                  Tokens Available for Purchase Limit
                </span>
                <Skeleton width={120} height={20} loading={isLoadingSupply}>
                  <span className="text-2 text-neutral-11">
                    {formatCurrencyValue(tokensAvailableLimit)}
                  </span>
                </Skeleton>
              </div>
            )}
          </div>
        )}
      </div>
    </Skeleton>
  );
};
