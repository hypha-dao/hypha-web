'use client';

import {
  Skeleton,
  RequirementMark,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  FormLabel,
} from '@hypha-platform/ui';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import type { TokenType } from '@hypha-platform/core/client';
import { TokenSelectDropdown } from '../../../../agreements/plugins/components/common/token-select-dropdown';

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
  isLoadingTreasuryBalance: boolean;
  supply: number | undefined;
  treasuryBalance: number | undefined;
};

export const TokenSelectionSection = ({
  spaceSlug,
  spaceTokens,
  selectedToken,
  isLoading,
  isLoadingSupply,
  isLoadingTreasuryBalance,
  supply,
  treasuryBalance,
}: TokenSelectionSectionProps) => {
  const t = useTranslations('SpaceTokenPurchase');
  const { lang } = useParams();
  const { control, setValue } = useFormContext();

  const dropdownTokens = useMemo(
    () =>
      spaceTokens
        .filter((tok) => tok.address)
        .map((tok) => ({
          address: tok.address as string,
          symbol: tok.symbol,
          iconUrl: tok.iconUrl || '/placeholder/token-icon.svg',
          type: tok.type as TokenType,
          spaceSubtitle: spaceSlug,
        })),
    [spaceTokens, spaceSlug],
  );

  const isLimitedSupply = selectedToken && Number(selectedToken.maxSupply) > 0;

  const tokensAvailableLimit = isLimitedSupply
    ? Math.max(
        0,
        Number(selectedToken.maxSupply) -
          Number(supply ?? 0) +
          Number(treasuryBalance ?? 0),
      )
    : undefined;

  return (
    <Skeleton loading={isLoading} width="100%" height={90}>
      <div className="flex flex-col gap-4">
        <FormLabel>{t('selection.sectionTitle')}</FormLabel>
        <span className="text-2 text-neutral-11">
          {t('selection.description')}
        </span>

        <div className="flex flex-col gap-4 md:flex-row md:items-start w-full">
          <div className="flex gap-1">
            <label className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
              {t('selection.fieldLabel')}
            </label>
            <RequirementMark className="text-2" />
          </div>
          <div className="flex flex-col gap-2 grow min-w-0">
            <FormField
              control={control}
              name="tokenAddress"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <TokenSelectDropdown
                      value={field.value ?? ''}
                      onValueChange={(val) => {
                        field.onChange(val);
                        const token = spaceTokens.find(
                          (tok) =>
                            tok.address?.toLowerCase() === val.toLowerCase(),
                        );
                        if (token?.referencePrice !== undefined) {
                          setValue('purchasePrice', token.referencePrice);
                        }
                        if (token?.referenceCurrency) {
                          setValue('purchaseCurrency', token.referenceCurrency);
                        }
                      }}
                      tokens={dropdownTokens}
                      placeholder={t('selection.placeholder')}
                      emptyMessage={t('selection.noTokenFound')}
                      disabled={dropdownTokens.length === 0}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {spaceTokens.length === 0 && !isLoading && (
              <div className="text-2 text-foreground">
                {t('selection.noTokenPrefix')}{' '}
                <Link
                  href={`/${lang}/dho/${spaceSlug}/agreements/create/issue-new-token`}
                  className="text-accent-9 underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t('selection.clickHere')}
                </Link>{' '}
                {t('selection.noTokenSuffix')}
              </div>
            )}
          </div>
        </div>

        {selectedToken && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between">
              <span className="text-2 text-neutral-11">
                {t('selection.tokenSupply')}
              </span>
              {selectedToken.maxSupply === 0 ? (
                <span className="text-2 text-neutral-11">
                  {t('selection.unlimitedSupply')}
                </span>
              ) : (
                <span className="text-2 text-neutral-11">
                  {formatCurrencyValue(selectedToken.maxSupply)}
                </span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-2 text-neutral-11">
                {t('selection.issuanceToDate')}
              </span>
              <Skeleton width={120} height={20} loading={isLoadingSupply}>
                <span className="text-2 text-neutral-11">
                  {formatCurrencyValue(supply ?? 0)}
                </span>
              </Skeleton>
            </div>
            {isLimitedSupply && tokensAvailableLimit !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-2 text-neutral-11">
                  {t('selection.availableLimit')}
                </span>
                <Skeleton
                  width={120}
                  height={20}
                  loading={isLoadingSupply || isLoadingTreasuryBalance}
                >
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
