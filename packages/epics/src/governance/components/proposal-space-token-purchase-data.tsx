'use client';

import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { formatUnits } from 'viem';
import { TOKENS } from '@hypha-platform/core/client';

interface ProposalSpaceTokenPurchaseDataProps {
  tokenAddress?: string;
  paymentToken?: string;
  paymentTokenPricePerToken?: bigint;
  tokensForSale?: bigint;
  isActive?: boolean;
}

export const ProposalSpaceTokenPurchaseData = ({
  tokenAddress,
  paymentToken,
  paymentTokenPricePerToken,
  tokensForSale,
  isActive,
}: ProposalSpaceTokenPurchaseDataProps) => {
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
        <div className="text-1 text-neutral-11 w-full">Token Address</div>
        <div className="text-1 break-all text-right">{tokenAddress ?? '-'}</div>
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
          <div className="text-1">
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
