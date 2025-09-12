'use client';

import { formatCurrencyValue } from '@hypha-platform/ui-utils';

interface ProposalBuyHyphaTokensDataProps {
  amount: bigint;
}

export const ProposalBuyHyphaTokensData = ({
  amount,
}: ProposalBuyHyphaTokensDataProps) => {
  const usdcDecimals = 6;
  const usdcAmount = Number(amount) / 10 ** usdcDecimals;
  const hyphaAmount = usdcAmount * 4;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">USDC Amount</div>
        <div className="text-1">{formatCurrencyValue(usdcAmount)}</div>
      </div>
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">HYPHA Amount</div>
        <div className="text-1">{formatCurrencyValue(hyphaAmount)}</div>
      </div>
    </div>
  );
};
