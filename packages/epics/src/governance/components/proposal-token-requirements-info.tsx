'use client';

import { TokenLabel } from './token-label';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';

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
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">Token</div>
        <div className="text-1">
          <TokenLabel spaceSlug={spaceSlug} tokenAddress={token} />
        </div>
      </div>
      <div className="flex justify-between items-center">
        <div className="text-1 text-neutral-11 w-full">Amount</div>
        <div className="text-1">{formatCurrencyValue(Number(amount))}</div>
      </div>
    </div>
  );
};
