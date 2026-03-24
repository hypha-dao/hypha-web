'use client';

import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

interface ProposalBuyHyphaTokensDataProps {
  amount: bigint;
}

export const ProposalBuyHyphaTokensData = ({
  amount,
}: ProposalBuyHyphaTokensDataProps) => {
  const tProposalDetails = useTranslations('ProposalDetails');
  const usdcDecimals = 6;
  const usdcAmount = Number(amount) / 10 ** usdcDecimals;
  const hyphaAmount = usdcAmount * 4;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">
          {tProposalDetails('labels.usdcAmount')}
        </div>
        <div className="text-1">{formatCurrencyValue(usdcAmount)}</div>
      </div>
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">
          {tProposalDetails('labels.hyphaAmount')}
        </div>
        <div className="text-1">{formatCurrencyValue(hyphaAmount)}</div>
      </div>
    </div>
  );
};
