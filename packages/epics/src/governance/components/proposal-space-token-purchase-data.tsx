'use client';

import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { formatUnits } from 'viem';
import { TOKENS } from '@hypha-platform/core/client';
import type { DbToken } from '@hypha-platform/core/server';
import { Image } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { resolveTokenDecimals } from '../utils/token-decimals';

interface ProposalSpaceTokenPurchaseDataProps {
  dbTokens?: DbToken[];
  tokenAddress?: string;
  paymentToken?: string;
  paymentTokenPricePerToken?: bigint;
  tokensForSale?: bigint;
  isActive?: boolean;
}

export const ProposalSpaceTokenPurchaseData = ({
  dbTokens,
  tokenAddress,
  paymentToken,
  paymentTokenPricePerToken,
  tokensForSale,
  isActive,
}: ProposalSpaceTokenPurchaseDataProps) => {
  const t = useTranslations('ProposalSpaceTokenPurchase');
  const tokenMeta = dbTokens?.find(
    (token) => token.address?.toLowerCase() === tokenAddress?.toLowerCase(),
  );
  const paymentTokenMeta = TOKENS.find(
    (token) => token.address?.toLowerCase() === paymentToken?.toLowerCase(),
  );

  const paymentTokenDecimals = resolveTokenDecimals(paymentToken);
  const tokenDecimals = resolveTokenDecimals(tokenAddress);

  const purchasePrice =
    paymentTokenPricePerToken !== undefined
      ? Number(formatUnits(paymentTokenPricePerToken, paymentTokenDecimals))
      : undefined;
  const tokenSaleAmount =
    tokensForSale !== undefined
      ? Number(formatUnits(tokensForSale, tokenDecimals))
      : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">{t('token')}</div>
        <div className="text-1 flex items-center gap-2">
          <Image
            className="rounded-full w-5 h-5"
            width={20}
            height={20}
            src={tokenMeta?.iconUrl || '/placeholder/neutral-token-icon.svg'}
            alt={tokenMeta?.symbol || t('token')}
          />
          <span>{tokenMeta?.symbol ?? tokenAddress ?? '-'}</span>
        </div>
      </div>
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">
          {t('purchaseStatus')}
        </div>
        <div className="text-1">{isActive ? t('enabled') : t('disabled')}</div>
      </div>
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">{t('paymentToken')}</div>
        <div className="text-1">
          {paymentTokenMeta?.symbol ?? paymentToken ?? t('notConfigured')}
        </div>
      </div>
      {purchasePrice !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {t('purchasePrice')}
          </div>
          <div className="text-1 whitespace-nowrap">
            {formatCurrencyValue(purchasePrice)}{' '}
            {paymentTokenMeta?.symbol ?? ''}
          </div>
        </div>
      )}
      {tokenSaleAmount !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {t('tokensForSale')}
          </div>
          <div className="text-1">{formatCurrencyValue(tokenSaleAmount)}</div>
        </div>
      )}
    </div>
  );
};
