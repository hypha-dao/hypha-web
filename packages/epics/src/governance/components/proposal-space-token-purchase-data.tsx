'use client';

import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { formatUnits } from 'viem';
import { TOKENS } from '@hypha-platform/core/client';
import type { DbToken } from '@hypha-platform/core/server';
import { Image } from '@hypha-platform/ui';

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
  const tokenMeta = dbTokens?.find(
    (token) => token.address?.toLowerCase() === tokenAddress?.toLowerCase(),
  );
  const paymentTokenMeta = TOKENS.find(
    (token) => token.address?.toLowerCase() === paymentToken?.toLowerCase(),
  );

  const purchasePrice =
    paymentTokenPricePerToken !== undefined
      ? Number(formatUnits(paymentTokenPricePerToken, 6))
      : undefined;
  const tokenSaleAmount =
    tokensForSale !== undefined
      ? Number(formatUnits(tokensForSale, 18))
      : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">Token</div>
        <div className="text-1 flex items-center gap-2">
          <Image
            className="rounded-full w-5 h-5"
            width={20}
            height={20}
            src={tokenMeta?.iconUrl || '/placeholder/neutral-token-icon.svg'}
            alt={tokenMeta?.symbol || 'Token'}
          />
          <span>{tokenMeta?.symbol ?? tokenAddress ?? '-'}</span>
        </div>
      </div>
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">Purchase Status</div>
        <div className="text-1">{isActive ? 'Enabled' : 'Disabled'}</div>
      </div>
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">Payment Token</div>
        <div className="text-1">
          {paymentTokenMeta?.symbol ?? paymentToken ?? 'Not configured'}
        </div>
      </div>
      {purchasePrice !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">Purchase Price</div>
          <div className="text-1 whitespace-nowrap">
            {formatCurrencyValue(purchasePrice)}{' '}
            {paymentTokenMeta?.symbol ?? ''}
          </div>
        </div>
      )}
      {tokenSaleAmount !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">Tokens For Sale</div>
          <div className="text-1">{formatCurrencyValue(tokenSaleAmount)}</div>
        </div>
      )}
    </div>
  );
};
