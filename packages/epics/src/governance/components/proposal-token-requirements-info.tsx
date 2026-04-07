'use client';

import { TokenLabel } from './token-label';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

interface ProposalTokenRequirementsInfoPops {
  token: `0x${string}`;
  amount: bigint;
  spaceSlug: string;
}

export const ProposalTokenRequirementsInfo = ({
  token,
  amount,
  spaceSlug,
}: ProposalTokenRequirementsInfoPops) => {
  const tProposalDetails = useTranslations('ProposalDetails');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">
          {tProposalDetails('labels.token')}
        </div>
        <div className="text-1">
          <TokenLabel spaceSlug={spaceSlug} tokenAddress={token} />
        </div>
      </div>
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">
          {tProposalDetails('labels.amount')}
        </div>
        <div className="text-1">{formatCurrencyValue(Number(amount))}</div>
      </div>
    </div>
  );
};
